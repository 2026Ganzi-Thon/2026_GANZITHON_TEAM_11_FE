import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { createMockReminder } from '../mocks/reminder';
import { createSettingsMorning } from '../mocks/settingsMorning';
import { createReminderConnection } from './connection';
import { createDeviceReminder } from './service';
import { createExpoAndroidPort } from './expoAndroid';
import { ownsReminder, REMINDER_CHANNEL } from './model';
import { DeviceReminderError } from './types';
const TEST_ID = 'yangsebam.reminder-test.preview';
let testQueue: Promise<unknown> = Promise.resolve();
function testJob<T>(job: () => Promise<T>): Promise<T> {
  const next = testQueue.then(job);
  testQueue = next.catch(() => undefined);
  return next;
}
function createSession() {
  const account = createMockReminder();
  const port = createExpoAndroidPort();
  const service = createDeviceReminder(port);
  const connected = createReminderConnection(account, service);
  const reminder = { ...account, ...connected };
  return {
    reminder,
    source: createSettingsMorning('success', { reminder }),
    device: connected.device,
    async reset() {
      await connected.save(
        { enabled: false, local_time: null },
        new AbortController().signal,
      );
      const value = connected.device.getSnapshot();
      if (value.phase !== 'ready' || value.state?.state !== 'off')
        throw new DeviceReminderError('cancel');
      await clearTest();
    },
    sendTest: () =>
      testJob(async () => {
        await port.ensureChannel();
        const permission = await service.readPermission();
        if (permission.status !== 'granted' || permission.channel !== 'enabled')
          throw new DeviceReminderError('permission');
        await Notifications.scheduleNotificationAsync({
          identifier: TEST_ID,
          content: {
            title: '양 세는 밤 · 알림 확인',
            body: '알림을 받을 준비가 됐어요.',
            sound: false,
          },
          trigger: { channelId: REMINDER_CHANNEL },
        });
      }),
  };
}
async function clearTest() {
  await testJob(async () => {
    await Notifications.cancelScheduledNotificationAsync(TEST_ID);
    await Notifications.dismissNotificationAsync(TEST_ID);
  });
}
let session: ReturnType<typeof createSession> | null = null;
export function getNativeReminderSession() {
  if (!session) session = createSession();
  return session;
}
/** Explicit startup from the development root; reads never request permission. */
export function startNativeReminderRuntime() {
  const current = getNativeReminderSession();
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const owned =
        ownsReminder(notification.request.identifier) ||
        notification.request.identifier === TEST_ID;
      return {
        shouldShowBanner: owned,
        shouldShowList: owned,
        shouldPlaySound: false,
        shouldSetBadge: false,
      };
    },
  });
  void clearTest().catch(() => undefined);
  void current.device.refresh();
  const listener = AppState.addEventListener('change', (state) => {
    if (state === 'active') void current.device.refresh();
  });
  return () => {
    listener.remove();
    Notifications.setNotificationHandler(null);
  };
}

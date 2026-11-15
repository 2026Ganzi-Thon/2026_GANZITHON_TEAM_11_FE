import { afterEach, expect, it, jest } from '@jest/globals';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { fakeDevice, scheduled } from './__tests__/fakeDevice';
import {
  getNativeReminderSession,
  startNativeReminderRuntime,
} from './nativeRuntime';
let mockPort: ReturnType<typeof fakeDevice>['port'];
jest.mock('./expoAndroid', () => ({ createExpoAndroidPort: () => mockPort }));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(async () => {}),
  dismissNotificationAsync: jest.fn(async () => {}),
  scheduleNotificationAsync: jest.fn(
    async () => 'yangsebam.reminder-test.preview',
  ),
}));
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
it('cleans old reservations on startup, refreshes saved preferences after foreground permission changes and removes only its own listener', async () => {
  jest.useFakeTimers();
  const native = fakeDevice();
  mockPort = native.port;
  native.records.set('yangsebam.night-reminder.daily', scheduled());
  native.records.set('unrelated', scheduled('unrelated'));
  let foreground!: (state: 'active' | 'background') => void;
  const remove = jest.fn();
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, listener) => {
      foreground = listener;
      return { remove };
    });
  const stop = startNativeReminderRuntime();
  await jest.runAllTimersAsync();
  expect([...native.records.keys()]).toEqual(['unrelated']);
  expect(native.port.requestPermission).not.toHaveBeenCalled();
  const current = getNativeReminderSession();
  const saving = current.source.settings.reminder.save(
    { enabled: true, local_time: '23:15' },
    new AbortController().signal,
  );
  await jest.runAllTimersAsync();
  await saving;
  expect(native.records.has('yangsebam.night-reminder.daily')).toBe(true);
  native.setPermission({
    status: 'denied',
    canAskAgain: false,
    channel: 'enabled',
  });
  foreground('active');
  await jest.runAllTimersAsync();
  expect([...native.records.keys()]).toEqual(['unrelated']);
  expect(current.device.getSnapshot()).toMatchObject({
    state: { state: 'permission-required' },
  });
  expect(current.source.settings.reminder.readSnapshot()).toEqual({
    enabled: true,
    local_time: '23:15',
  });
  stop();
  expect(remove).toHaveBeenCalledTimes(1);
  expect(Notifications.setNotificationHandler).toHaveBeenLastCalledWith(null);
});

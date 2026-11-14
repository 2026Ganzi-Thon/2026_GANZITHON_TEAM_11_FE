import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { createExpoAndroidPort } from './expoAndroid';
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getNotificationChannelAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  AndroidImportance: { NONE: 2, DEFAULT: 5 },
  SchedulableTriggerInputTypes: { DAILY: 'daily' },
}));
const granted: Notifications.NotificationPermissionsStatus = {
  status: 'granted' as Notifications.NotificationPermissionsStatus['status'],
  granted: true,
  canAskAgain: true,
  expires: 'never',
};
const channel: Notifications.NotificationChannel = {
  id: 'night-reminder',
  name: '밤에 와 알림',
  importance: 5,
  bypassDnd: false,
  description: null,
  groupId: null,
  lightColor: '#000000',
  lockscreenVisibility: 2,
  showBadge: false,
  sound: null,
  audioAttributes: {
    usage: 5,
    contentType: 4,
    flags: {
      enforceAudibility: false,
      requestHardwareAudioVideoSynchronization: false,
    },
  },
  vibrationPattern: null,
  enableLights: false,
  enableVibrate: false,
};
const request: Notifications.NotificationRequest = {
  identifier: 'yangsebam.night-reminder.daily',
  content: {
    title: '양 세는 밤',
    body: '오늘 밤도 양과 함께 쉬어 가요.',
    subtitle: null,
    categoryIdentifier: null,
    sound: null,
    threadIdentifier: null,
    data: { schema_version: 1, local_time: '23:15' },
  },
  trigger: {
    type: 'daily',
    hour: 23,
    minute: 15,
    delivery: 'bestEffort',
    channelId: 'night-reminder',
  } as Notifications.NotificationTrigger,
};
const platformOS = Object.getOwnPropertyDescriptor(Platform, 'OS')!;
const platformVersion = Object.getOwnPropertyDescriptor(Platform, 'Version')!;
beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: 'android',
  });
  Object.defineProperty(Platform, 'Version', { configurable: true, value: 36 });
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue(granted);
  jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValue(granted);
  jest
    .mocked(Notifications.getNotificationChannelAsync)
    .mockResolvedValue(channel);
  jest
    .mocked(Notifications.setNotificationChannelAsync)
    .mockResolvedValue(channel);
  jest
    .mocked(Notifications.scheduleNotificationAsync)
    .mockResolvedValue('yangsebam.night-reminder.daily');
  jest
    .mocked(Notifications.cancelScheduledNotificationAsync)
    .mockResolvedValue(undefined);
  jest
    .mocked(Notifications.getAllScheduledNotificationsAsync)
    .mockResolvedValue([request]);
});
afterEach(() => {
  Object.defineProperty(Platform, 'OS', platformOS);
  Object.defineProperty(Platform, 'Version', platformVersion);
  jest.restoreAllMocks();
});
it('maps app permission separately from blocked/missing notification channel', async () => {
  const port = createExpoAndroidPort();
  expect(await port.readPermission()).toEqual({
    status: 'granted',
    canAskAgain: true,
    channel: 'enabled',
  });
  jest
    .mocked(Notifications.getNotificationChannelAsync)
    .mockResolvedValueOnce({ ...channel, importance: 2 });
  expect(await port.readPermission()).toMatchObject({ channel: 'blocked' });
  jest
    .mocked(Notifications.getNotificationChannelAsync)
    .mockResolvedValueOnce(null);
  expect(await port.readPermission()).toMatchObject({ channel: 'missing' });
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
});
it('only requests permission explicitly and provides application settings access', async () => {
  const port = createExpoAndroidPort(),
    open = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
  await port.requestPermission();
  expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  await port.openSettings();
  expect(open).toHaveBeenCalledTimes(1);
});
it('schedules a quiet daily reminder with a fixed ID, exact requested values and bestEffort delivery', async () => {
  const port = createExpoAndroidPort();
  await port.ensureChannel();
  await port.schedule({
    id: 'yangsebam.night-reminder.daily',
    localTime: '23:15',
    hour: 23,
    minute: 15,
  });
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
    identifier: 'yangsebam.night-reminder.daily',
    content: {
      title: '양 세는 밤',
      body: '오늘 밤도 양과 함께 쉬어 가요.',
      sound: false,
      data: { schema_version: 1, local_time: '23:15' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 23,
      minute: 15,
      delivery: 'bestEffort',
      channelId: 'night-reminder',
    },
  });
  expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
    'night-reminder',
    expect.objectContaining({
      importance: 5,
      sound: null,
      enableVibrate: false,
    }),
  );
});
it('reads the native trigger and schema, including channel, rather than inventing a current schedule', async () => {
  expect(await createExpoAndroidPort().list()).toEqual([
    {
      id: 'yangsebam.night-reminder.daily',
      daily: true,
      channelId: 'night-reminder',
      hour: 23,
      minute: 15,
      localTime: '23:15',
      version: 1,
      delivery: 'bestEffort',
    },
  ]);
});
it('rejects mismatched native input and never cancels another feature ID', async () => {
  const port = createExpoAndroidPort();
  await expect(
    port.schedule({ id: 'other', localTime: '23:15', hour: 23, minute: 15 }),
  ).rejects.toMatchObject({ code: 'invalid-setting' });
  await expect(
    port.schedule({
      id: 'yangsebam.night-reminder.daily',
      localTime: '23:15',
      hour: 22,
      minute: 15,
    }),
  ).rejects.toMatchObject({ code: 'invalid-setting' });
  await expect(port.cancel('other')).rejects.toMatchObject({
    code: 'invalid-setting',
  });
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
});
it('does not treat missing channels as blocking on Android before API26', async () => {
  Object.defineProperty(Platform, 'Version', { configurable: true, value: 25 });
  jest
    .mocked(Notifications.getNotificationChannelAsync)
    .mockResolvedValue(null);
  expect(await createExpoAndroidPort().readPermission()).toMatchObject({
    channel: 'enabled',
  });
});
it('rejects contradictory native permission values', async () => {
  jest
    .mocked(Notifications.getPermissionsAsync)
    .mockResolvedValue({ ...granted, granted: false });
  await expect(createExpoAndroidPort().readPermission()).rejects.toMatchObject({
    code: 'permission',
  });
});
it('does not invoke Android notification APIs on unsupported platforms', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  await expect(createExpoAndroidPort().list()).rejects.toMatchObject({
    code: 'platform',
  });
  expect(
    Notifications.getAllScheduledNotificationsAsync,
  ).not.toHaveBeenCalled();
});
it('cancels only the requested owned ID instead of clearing all scheduled notifications', async () => {
  await createExpoAndroidPort().cancel('yangsebam.night-reminder.daily');
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
    'yangsebam.night-reminder.daily',
  );
});
it('does not reuse incomplete native metadata as a valid daily request', async () => {
  jest
    .mocked(Notifications.getAllScheduledNotificationsAsync)
    .mockResolvedValue([
      { ...request, trigger: null, content: { ...request.content, data: {} } },
    ]);
  expect(await createExpoAndroidPort().list()).toEqual([
    {
      id: 'yangsebam.night-reminder.daily',
      daily: false,
      channelId: null,
      hour: null,
      minute: null,
      localTime: null,
      version: null,
      delivery: null,
    },
  ]);
});

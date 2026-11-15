import { jest } from '@jest/globals';
import type {
  DevicePermission,
  DeviceReminderPort,
  ScheduledReminder,
} from '../types';
export function scheduled(
  id = 'yangsebam.night-reminder.daily',
  time = '23:15',
): ScheduledReminder {
  const [hour, minute] = time.split(':').map(Number);
  return {
    id,
    daily: true,
    channelId: 'night-reminder',
    hour,
    minute,
    localTime: time,
    version: 1,
    delivery: 'bestEffort',
  };
}
export function fakeDevice() {
  const records = new Map<string, ScheduledReminder>();
  let permission: DevicePermission = {
    status: 'granted',
    canAskAgain: true,
    channel: 'enabled',
  };
  const port = {
    readPermission: jest
      .fn<DeviceReminderPort['readPermission']>()
      .mockImplementation(async () => ({ ...permission })),
    requestPermission: jest
      .fn<DeviceReminderPort['requestPermission']>()
      .mockImplementation(async () => ({ ...permission })),
    ensureChannel: jest
      .fn<DeviceReminderPort['ensureChannel']>()
      .mockResolvedValue(undefined),
    openSettings: jest
      .fn<DeviceReminderPort['openSettings']>()
      .mockResolvedValue(undefined),
    timeZone: jest
      .fn<DeviceReminderPort['timeZone']>()
      .mockReturnValue('Asia/Seoul'),
    list: jest
      .fn<DeviceReminderPort['list']>()
      .mockImplementation(async () =>
        [...records.values()].map((value) => ({ ...value })),
      ),
    schedule: jest
      .fn<DeviceReminderPort['schedule']>()
      .mockImplementation(async (request) => {
        records.set(request.id, scheduled(request.id, request.localTime));
        return request.id;
      }),
    cancel: jest
      .fn<DeviceReminderPort['cancel']>()
      .mockImplementation(async (id) => {
        records.delete(id);
      }),
  };
  return {
    port,
    records,
    setPermission: (value: DevicePermission) => {
      permission = value;
    },
  };
}
export function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: Error) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

import { jest } from '@jest/globals';
import type { ReminderRequest, ScheduledReminder } from '../types';
import { fakeDevice, scheduled } from './fakeDevice';
/** Mirrors Expo's store-first / AlarmManager-second order, including partial failure. */
export function storedDevice() {
  const device = fakeDevice();
  const alarms = new Map<string, ScheduledReminder>();
  const registerAlarm = jest
    .fn<(request: ReminderRequest) => Promise<void>>()
    .mockImplementation(async (request) => {
      alarms.set(request.id, scheduled(request.id, request.localTime));
    });
  device.port.schedule.mockImplementation(async (request) => {
    device.records.set(request.id, scheduled(request.id, request.localTime));
    await registerAlarm(request);
    return request.id;
  });
  device.port.cancel.mockImplementation(async (id) => {
    alarms.delete(id);
    device.records.delete(id);
  });
  return { ...device, alarms, registerAlarm };
}

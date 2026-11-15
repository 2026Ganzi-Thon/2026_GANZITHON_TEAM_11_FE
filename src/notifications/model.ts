import { DeviceReminderError, type ScheduledReminder } from './types';
export const REMINDER_ID = 'yangsebam.night-reminder.daily';
export const REMINDER_CHANNEL = 'night-reminder';
export function reminderTime(
  value: unknown,
): { hour: number; minute: number } | null {
  if (!value || typeof value !== 'object')
    throw new DeviceReminderError('invalid-setting');
  const setting = value as { enabled?: unknown; local_time?: unknown };
  if (setting.enabled === false && setting.local_time === null) return null;
  if (
    setting.enabled !== true ||
    typeof setting.local_time !== 'string' ||
    !/^(?:[01]\d|2[0-3]):(?:00|15|30|45)$/.test(setting.local_time)
  )
    throw new DeviceReminderError('invalid-setting');
  const [hour, minute] = setting.local_time.split(':').map(Number);
  return { hour, minute };
}
export function ownsReminder(id: string): boolean {
  return id.startsWith('yangsebam.night-reminder.');
}
export function matchesReminder(
  value: ScheduledReminder,
  time: string,
): boolean {
  const parts = reminderTime({ enabled: true, local_time: time });
  return (
    value.id === REMINDER_ID &&
    value.channelId === REMINDER_CHANNEL &&
    value.daily &&
    value.version === 1 &&
    value.localTime === time &&
    value.hour === parts?.hour &&
    value.minute === parts?.minute &&
    value.delivery === 'bestEffort'
  );
}

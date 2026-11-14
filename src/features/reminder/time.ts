import type { Reminder } from './types';
export interface TimeParts {
  period: number;
  hour: number;
  minute: number;
}
export function parseLocalTime(value: unknown): TimeParts | null {
  if (
    typeof value !== 'string' ||
    !/^(?:[01]\d|2[0-3]):(?:00|15|30|45)$/.test(value)
  )
    return null;
  const [hour, minute] = value.split(':').map(Number);
  return { period: hour >= 12 ? 1 : 0, hour: hour % 12 || 12, minute };
}
export function formatLocalTime(value: TimeParts): string | null {
  if (
    ![0, 1].includes(value.period) ||
    !Number.isInteger(value.hour) ||
    value.hour < 1 ||
    value.hour > 12 ||
    ![0, 15, 30, 45].includes(value.minute)
  )
    return null;
  return `${String((value.hour % 12) + value.period * 12).padStart(2, '0')}:${String(value.minute).padStart(2, '0')}`;
}
export function validReminder(value: unknown): value is Reminder {
  if (!value || typeof value !== 'object') return false;
  const item = value as Reminder;
  return (
    typeof item.enabled === 'boolean' &&
    (item.enabled
      ? parseLocalTime(item.local_time) !== null
      : item.local_time === null)
  );
}
export function sameReminder(a: Reminder, b: Reminder): boolean {
  return a.enabled === b.enabled && a.local_time === b.local_time;
}
export function reminderLabel(value: Reminder): string {
  return value.enabled ? `켜짐 · ${value.local_time}` : '꺼짐';
}

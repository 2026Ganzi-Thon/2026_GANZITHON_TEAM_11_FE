import { expect, it } from '@jest/globals';
import { reminderTime, ownsReminder, matchesReminder } from './model';
import type { ScheduledReminder } from './types';
it.each([
  ['00:00', { hour: 0, minute: 0 }],
  ['12:00', { hour: 12, minute: 0 }],
  ['23:45', { hour: 23, minute: 45 }],
] as const)('accepts %s as the exact target time', (time, expected) => {
  expect(reminderTime({ enabled: true, local_time: time })).toEqual(expected);
});
it.each([
  null,
  {},
  { enabled: false, local_time: '23:00' },
  { enabled: true, local_time: null },
  { enabled: true, local_time: '23:01' },
  { enabled: true, local_time: '24:00' },
  { enabled: true, local_time: '1:15' },
])('rejects malformed preferences %p', (value) => {
  expect(() => reminderTime(value)).toThrow();
});
it('accepts an explicit OFF with no timestamp', () => {
  expect(reminderTime({ enabled: false, local_time: null })).toBeNull();
});
it('owns only the dedicated namespace, including obsolete duplicate IDs', () => {
  expect(ownsReminder('yangsebam.night-reminder.daily')).toBe(true);
  expect(ownsReminder('yangsebam.night-reminder.old-copy')).toBe(true);
  expect(ownsReminder('other-reminder')).toBe(false);
  expect(ownsReminder('yangsebam.night-reminder')).toBe(false);
});
const scheduled: ScheduledReminder = {
  id: 'yangsebam.night-reminder.daily',
  daily: true,
  channelId: 'night-reminder',
  hour: 23,
  minute: 15,
  localTime: '23:15',
  version: 1,
  delivery: 'bestEffort',
};
it.each([
  { channelId: 'another-channel' },
  { hour: 22 },
  { minute: 30 },
  { localTime: '23:30' },
  { version: 0 },
  { daily: false },
  { delivery: 'alarmClock' as const },
  { id: 'yangsebam.night-reminder.duplicate' },
])('rejects stale or incompatible SDK request metadata %p', (changed) => {
  expect(matchesReminder({ ...scheduled, ...changed }, '23:15')).toBe(false);
});
it('recognizes matching SDK request metadata without proving an OS alarm exists', () => {
  expect(matchesReminder(scheduled, '23:15')).toBe(true);
});

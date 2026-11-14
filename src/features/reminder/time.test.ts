import { expect, it } from '@jest/globals';
import { formatLocalTime, parseLocalTime, validReminder } from './time';
it.each([
  ['00:00', { period: 0, hour: 12, minute: 0 }],
  ['12:00', { period: 1, hour: 12, minute: 0 }],
  ['23:45', { period: 1, hour: 11, minute: 45 }],
  ['01:15', { period: 0, hour: 1, minute: 15 }],
  ['13:30', { period: 1, hour: 1, minute: 30 }],
] as const)(
  'round trips %s without confusing noon and midnight',
  (text, parts) => {
    expect(parseLocalTime(text)).toEqual(parts);
    expect(formatLocalTime(parts)).toBe(text);
  },
);
it.each(['24:00', '23:59', '1:00', '00:60', '12:01', '', ' 23:00'])(
  'rejects invalid time %s',
  (time) => {
    expect(parseLocalTime(time)).toBeNull();
    expect(validReminder({ enabled: true, local_time: time })).toBe(false);
  },
);
it.each([
  [{ enabled: true, local_time: '23:00' }, true],
  [{ enabled: false, local_time: null }, true],
  [{ enabled: false, local_time: '23:00' }, false],
  [{ enabled: true, local_time: null }, false],
  [{ enabled: 1, local_time: '23:00' }, false],
  [null, false],
  [{}, false],
])('validates the whole reminder target %p', (value, expected) => {
  expect(validReminder(value)).toBe(expected);
});
it('rejects invalid wheel values rather than serializing an invalid request', () => {
  expect(formatLocalTime({ period: 2, hour: 11, minute: 0 })).toBeNull();
  expect(formatLocalTime({ period: 0, hour: 0, minute: 0 })).toBeNull();
  expect(formatLocalTime({ period: 1, hour: 12, minute: 14 })).toBeNull();
});

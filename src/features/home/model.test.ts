import { expect, it } from '@jest/globals';
import { readHomeSnapshot, untilHomeBoundary, fortuneDate } from './model';
const snapshot = {
  server_time: '2026-11-15T12:00:00+09:00',
  timezone: 'Asia/Seoul',
  phase: 'day',
  user: { id: 'home-user', stats: { night_count: 0 } },
};
it.each([
  ['2026-11-15T20:59:59+09:00', 'day', 1000],
  ['2026-11-15T21:00:00+09:00', 'night', 7 * 60 * 60 * 1000],
  ['2026-11-16T03:59:59+09:00', 'night', 1000],
  ['2026-11-16T04:00:00+09:00', 'day', 17 * 60 * 60 * 1000],
])(
  'uses KST server time at %s (%s) and schedules the next boundary',
  (time, phase, delay) => {
    expect(
      readHomeSnapshot({ ...snapshot, server_time: time, phase }).phase,
    ).toBe(phase);
    expect(untilHomeBoundary(Date.parse(time))).toBe(delay);
  },
);
it.each([
  { server_time: '2026-11-15T21:00:00' },
  { server_time: '2026-02-30T12:00:00+09:00' },
  { phase: 'night' },
  { timezone: 'UTC' },
  { user: { id: '', stats: { night_count: 0 } } },
  { user: { id: 'home-user', stats: { night_count: -1 } } },
  { user: { id: 'home-user', stats: { night_count: 0.5 } } },
])(
  'rejects uncertain clock or statistics instead of treating them as the first night (%p)',
  (invalid) => {
    expect(() => readHomeSnapshot({ ...snapshot, ...invalid })).toThrow();
  },
);
it('keeps the previous fortune date until 04:00 KST', () => {
  expect(fortuneDate(Date.parse('2026-11-16T03:59:59+09:00'))).toBe(
    '2026-11-15',
  );
  expect(fortuneDate(Date.parse('2026-11-16T04:00:00+09:00'))).toBe(
    '2026-11-16',
  );
});

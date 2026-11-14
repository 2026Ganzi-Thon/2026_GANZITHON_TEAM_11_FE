import { expect, it } from '@jest/globals';
import {
  birthDateError,
  daysInMonth,
  formatDate,
  kstDate,
  withDatePart,
} from './date';
it.each([
  [{ year: 2000, month: 2, day: 29 }, null],
  [{ year: 1900, month: 2, day: 29 }, 'invalid'],
  [{ year: 2024, month: 2, day: 29 }, null],
  [{ year: 2023, month: 2, day: 29 }, 'invalid'],
  [{ year: 2004, month: 4, day: 31 }, 'invalid'],
  [{ year: 2004, month: 13, day: 1 }, 'invalid'],
  [{ year: 0, month: 1, day: 1 }, 'invalid'],
  [{ year: 2004.5, month: 1, day: 1 }, 'invalid'],
  [{ year: 2026, month: 11, day: 14 }, null],
  [{ year: 2026, month: 11, day: 15 }, 'future'],
] as const)(
  'validates date %j against a hand-checked calendar',
  (parts, error) => {
    expect(birthDateError(parts, '2026-11-14')).toBe(error);
  },
);
it('clamps only the day when changing to a shorter month or non-leap year', () => {
  expect(withDatePart({ year: 2024, month: 2, day: 29 }, 'year', 2023)).toEqual(
    { year: 2023, month: 2, day: 28 },
  );
  expect(withDatePart({ year: 2004, month: 1, day: 31 }, 'month', 4)).toEqual({
    year: 2004,
    month: 4,
    day: 30,
  });
  expect(daysInMonth(2000, 2)).toBe(29);
  expect(formatDate({ year: 9, month: 2, day: 3 })).toBe('0009-02-03');
});
it('uses Seoul calendar days at the UTC 15:00 boundary', () => {
  expect(kstDate(new Date('2026-11-13T14:59:59Z'))).toBe('2026-11-13');
  expect(kstDate(new Date('2026-11-13T15:00:00Z'))).toBe('2026-11-14');
});

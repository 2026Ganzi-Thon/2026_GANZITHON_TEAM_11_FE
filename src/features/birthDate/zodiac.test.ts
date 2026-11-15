import { expect, it } from '@jest/globals';
import { previewZodiac } from './zodiac';
it.each([
  ['2000-02-29', 'pisces'],
  ['2004-04-19', 'aries'],
  ['2004-04-20', 'taurus'],
  ['2004-05-20', 'taurus'],
  ['2004-05-21', 'gemini'],
  ['2004-12-22', 'capricorn'],
  ['2004-01-01', 'capricorn'],
] as const)('previews %s as %s', (date, want) => {
  expect(previewZodiac(date)).toBe(want);
});

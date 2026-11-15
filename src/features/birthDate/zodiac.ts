import { parseDate } from './date';
import type { BirthDateResult } from './types';
/** Calendar preview only; saved zodiac is supplied by the service. */
export function previewZodiac(date: string): BirthDateResult['zodiac'] {
  const p = parseDate(date)!;
  const day = p.month * 100 + p.day;
  const starts = [
    [120, 'aquarius'],
    [219, 'pisces'],
    [321, 'aries'],
    [420, 'taurus'],
    [521, 'gemini'],
    [621, 'cancer'],
    [723, 'leo'],
    [823, 'virgo'],
    [923, 'libra'],
    [1023, 'scorpio'],
    [1122, 'sagittarius'],
    [1222, 'capricorn'],
  ] as const;
  let zodiac: BirthDateResult['zodiac'] = 'capricorn';
  for (const [start, value] of starts) if (day >= start) zodiac = value;
  return zodiac;
}

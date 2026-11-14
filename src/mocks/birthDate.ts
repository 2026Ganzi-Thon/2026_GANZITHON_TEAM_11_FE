import { ApiError } from '../api/errors';
import { birthDateError, kstDate, parseDate } from '../features/birthDate/date';
import type {
  BirthDateActions,
  BirthDateResult,
  BirthDateSnapshot,
} from '../features/birthDate/types';
/** Shared read projection for mock account adapters, not an HTTP endpoint. */
export interface MockBirthDate extends BirthDateActions {
  readSnapshot(): BirthDateSnapshot;
}
export type BirthDateScenario =
  | 'success'
  | 'exhausted'
  | 'load-retry'
  | 'save-retry'
  | 'lost-response'
  | 'slow'
  | 'conflict'
  | 'conflict-load-retry'
  | 'validation-error'
  | 'age-rejected'
  | 'invalid-response';
/** Deterministic preview ranges only. Production zodiac comes from the service. */
function previewZodiac(date: string): BirthDateResult['zodiac'] {
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
/** API A-09 is a proposal; this sample is not a legal age determination. */
function allowedAge(date: string, today: string): boolean {
  const p = parseDate(date)!,
    t = parseDate(today)!;
  return (
    p.year < t.year - 14 ||
    (p.year === t.year - 14 && p.month * 100 + p.day <= t.month * 100 + t.day)
  );
}
export function createMockBirthDate(
  scenario: BirthDateScenario = 'success',
  now: () => Date = () => new Date('2026-11-14T12:30:00Z'),
): MockBirthDate {
  let record: BirthDateResult = {
    birth_date: '2004-05-14',
    edits_remaining: scenario === 'exhausted' ? 0 : 1,
    zodiac: 'taurus',
  };
  let conflictOccurred = false;
  const failed = new Set<string>();
  const failOnce = (key: string) => {
    if (!failed.has(key)) {
      failed.add(key);
      throw new ApiError('network');
    }
  };
  function delayed<T>(
    signal: AbortSignal,
    action: () => T,
    ms = 500,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new ApiError('aborted'));
        return;
      }
      const cleanup = () => {
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
      };
      const abort = () => {
        cleanup();
        reject(new ApiError('aborted'));
      };
      const timer = setTimeout(() => {
        cleanup();
        try {
          resolve(action());
        } catch (error) {
          reject(error);
        }
      }, ms);
      signal.addEventListener('abort', abort, { once: true });
    });
  }
  const readSnapshot = (): BirthDateSnapshot => ({
    ...record,
    today: kstDate(now()),
  });
  return {
    readSnapshot,
    load: (signal) =>
      delayed(signal, () => {
        if (scenario === 'load-retry') failOnce('load');
        if (scenario === 'conflict-load-retry' && conflictOccurred)
          failOnce('conflict-load');
        return readSnapshot();
      }),
    save: (date, signal) =>
      delayed(
        signal,
        () => {
          const parts = parseDate(date);
          if (!parts || birthDateError(parts, kstDate(now())))
            throw new ApiError('http', {
              status: 422,
              code: 'VALIDATION_ERROR',
            });
          if (date === record.birth_date) return { ...record };
          if (scenario === 'save-retry') failOnce('save');
          if (scenario === 'validation-error' && !failed.has('validation')) {
            failed.add('validation');
            throw new ApiError('http', {
              status: 422,
              code: 'VALIDATION_ERROR',
            });
          }
          if (
            (scenario === 'age-rejected' && !failed.has('age')) ||
            !allowedAge(date, kstDate(now()))
          ) {
            failed.add('age');
            throw new ApiError('http', {
              status: 422,
              code: 'AGE_NOT_ALLOWED',
            });
          }
          if (
            (scenario === 'conflict' || scenario === 'conflict-load-retry') &&
            !conflictOccurred
          ) {
            conflictOccurred = true;
            record = {
              birth_date: '2002-06-15',
              edits_remaining: 0,
              zodiac: 'gemini',
            };
            throw new ApiError('http', {
              status: 409,
              code: 'BIRTH_DATE_EDIT_LIMIT',
            });
          }
          if (record.edits_remaining === 0)
            throw new ApiError('http', {
              status: 409,
              code: 'BIRTH_DATE_EDIT_LIMIT',
            });
          record = {
            birth_date: date,
            edits_remaining: 0,
            zodiac: previewZodiac(date),
          };
          if (scenario === 'lost-response') failOnce('lost');
          if (scenario === 'invalid-response' && !failed.has('invalid')) {
            failed.add('invalid');
            return { ...record, birth_date: '2001-01-01' };
          }
          return { ...record };
        },
        scenario === 'slow' ? 5000 : 500,
      ),
  };
}

import { ApiError } from '../../api/errors';
import { zodiacNames } from '../fortune/types';
import { parseDate } from './date';
/** BirthDate response and a read projection for the standalone preview. */
export interface BirthDateResult {
  birth_date: string;
  edits_remaining: number;
  zodiac: keyof typeof zodiacNames;
}
/** today is the service's Seoul calendar date; adapter mapping awaits integration. */
export interface BirthDateSnapshot extends BirthDateResult {
  today: string;
}
export interface BirthDateActions {
  load(signal: AbortSignal): Promise<BirthDateSnapshot>;
  save(birthDate: string, signal: AbortSignal): Promise<BirthDateResult>;
}
export function validBirthDateResult(value: BirthDateResult): boolean {
  return (
    !!value &&
    !!parseDate(value.birth_date) &&
    [0, 1].includes(value.edits_remaining) &&
    Object.hasOwn(zodiacNames, value.zodiac)
  );
}
export function checkSnapshot(value: BirthDateSnapshot): void {
  if (
    !validBirthDateResult(value) ||
    !parseDate(value.today) ||
    value.birth_date > value.today
  )
    throw new ApiError('invalid-response');
}

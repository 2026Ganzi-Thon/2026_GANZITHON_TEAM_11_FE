import { afterEach, expect, it, jest } from '@jest/globals';
import { createMockBirthDate } from './birthDate';
import { createSettingsMorning } from './settingsMorning';
const signal = () => new AbortController().signal;
async function settle<T>(promise: Promise<T>) {
  await jest.runAllTimersAsync();
  return promise;
}
afterEach(() => {
  jest.useRealTimers();
});
it.each([
  ['2004-05-15', 'taurus', 3, 'sparkling'],
  ['2004-06-14', 'gemini', null, 'relaxed'],
] as const)(
  'keeps the fixed daily result for %s when the same account adapter is recreated',
  async (date, zodiac, rank, sheep_type) => {
    jest.useFakeTimers();
    const account = createMockBirthDate();
    const first = createSettingsMorning('success', { birthDate: account });
    await settle(account.save(date, signal()));
    const result = await settle(first.fortune.load(signal()));
    expect(result).toMatchObject({
      date: '2026-11-14',
      zodiac,
      rank,
      sheep_type,
    });
    const reopened = createSettingsMorning('success', { birthDate: account });
    expect(await settle(reopened.fortune.load(signal()))).toEqual(result);
    const profile = await settle(reopened.settings.loadMe(signal()));
    expect(profile.user).toMatchObject({
      birth_date: date,
      birth_date_edits_remaining: 0,
    });
  },
);

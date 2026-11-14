import { ApiError } from '../api/errors';
import type { SettingsData } from '../features/settings/types';
import { createMockBirthDate, type MockBirthDate } from './birthDate';
import { createMockFortune } from './fortune';
import { createMockMorning } from './morning';
import {
  createMockSettings,
  createSettingsWorryRecords,
  type SettingsScenario,
} from './settings';
export interface SettingsMorningOptions {
  birthDate?: MockBirthDate;
  profileRefreshFailure?: boolean;
  fortuneRefreshFailure?: boolean;
}
export function createSettingsMorning(
  scenario: SettingsScenario = 'success',
  options: SettingsMorningOptions = {},
) {
  const records = createSettingsWorryRecords(scenario);
  const base = createMockMorning(
    'existing',
    'success',
    'success',
    scenario === 'delete-retry'
      ? 'retry'
      : scenario === 'delete-lost'
        ? 'lost-response'
        : scenario === 'delete-slow'
          ? 'slow'
          : 'success',
    records,
  );
  const account = options.birthDate ?? createMockBirthDate();
  const initial = account.readSnapshot();
  const settings = createMockSettings(scenario, records);
  // Two fixed daily examples; this does not generate or rank real fortunes.
  const taurusFortune = createMockFortune();
  const otherFortune = createMockFortune('relaxed');
  let profileFailed = false,
    fortuneFailed = false;
  return {
    ...base,
    fortune: {
      load: async (signal: AbortSignal) => {
        const profile = account.readSnapshot();
        const value = await (
          profile.zodiac === 'taurus' ? taurusFortune : otherFortune
        ).load(signal);
        if (
          options.fortuneRefreshFailure &&
          profile.birth_date !== initial.birth_date &&
          !fortuneFailed
        ) {
          fortuneFailed = true;
          throw new ApiError('network');
        }
        return { ...value, zodiac: profile.zodiac, date: profile.today };
      },
    },
    settings: {
      ...settings,
      birthDate: account,
      deletions: base.worries,
      loadMe: async (signal: AbortSignal): Promise<SettingsData> => {
        const data = await settings.loadMe(signal);
        const profile = account.readSnapshot();
        if (
          options.profileRefreshFailure &&
          profile.birth_date !== initial.birth_date &&
          !profileFailed
        ) {
          profileFailed = true;
          throw new ApiError('network');
        }
        return {
          ...data,
          user: {
            ...data.user,
            birth_date: profile.birth_date,
            birth_date_edits_remaining: profile.edits_remaining,
          },
        };
      },
    },
  };
}

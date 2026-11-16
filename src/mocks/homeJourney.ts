import { ApiError } from '../api/errors';
import { createNightMorningNavigation } from '../features/demo/navigation';
import type { HomeSource } from '../features/home/types';
import type { SettingsActions } from '../features/settings/types';
import type { Morning } from '../features/morning/types';
import { createMockBirthDate } from './birthDate';
import { createMockHome } from './firstNightHome';
import type { SettingsMorningOptions } from './settingsMorning';
import { createNightMorningDemo } from './nightMorningDemo';
export type HomeJourneyScenario =
  'success' | 'lost-responses' | 'home-retry' | 'morning-retry';
export function createMockHomeJourney(
  scenario: HomeJourneyScenario = 'success',
  options: SettingsMorningOptions = {},
) {
  const nightDate = '2026-11-16';
  const night = createNightMorningDemo(
    scenario === 'lost-responses' ? 'lost-responses' : 'success',
    { nightId: 'journey-night', nightDate, manageWorries: true },
  );
  let base = Date.parse(`${nightDate}T21:30:00+09:00`),
    started = performance.now();
  const now = () => base + performance.now() - started;
  const original = createMockHome('night', {
    ...options,
    birthDate:
      options.birthDate ??
      createMockBirthDate('success', () => new Date(now())),
    now,
    identity: { id: 'journey-account', email: 'journey@example.com' },
  });
  const stats = () => {
    const record = night.getRecord();
    return {
      night_count: record.finished && record.counted > 0 ? 1 : 0,
      counted_sheep_total: record.counted,
      worry_record_count: record.night?.worry_text?.trim() ? 1 : 0,
    };
  };
  let advanced = false;
  let clockFailed = false,
    morningFailed = false;
  const settings: SettingsActions = {
    ...original.settings!,
    deletions: night.morning.worries,
    loadMe: async (signal) => {
      const value = await original.settings!.loadMe(signal);
      return { ...value, user: { ...value.user, stats: stats() } };
    },
    worries: {
      load: async (_query, signal) => {
        await original.settings!.loadMe(signal);
        if (signal.aborted) throw new ApiError('aborted');
        const record = night.getRecord().night;
        return {
          items: record?.worry_text?.trim()
            ? [
                {
                  night_id: record.id,
                  night_date: record.night_date,
                  category_id: record.category_id,
                  worry_text: record.worry_text,
                  reflection: record.reflection,
                },
              ]
            : [],
          next_cursor: null,
        };
      },
    },
  };
  const home: HomeSource = {
    ...original,
    settings,
    loadDetail: night.morning.loadSheep,
    clock: {
      load: async (signal) => {
        const value = await original.clock.load(signal);
        if (scenario === 'home-retry' && !clockFailed) {
          clockFailed = true;
          throw new ApiError('network');
        }
        return {
          ...value,
          user: { ...value.user, stats: { night_count: stats().night_count } },
        };
      },
    },
    morning: {
      ...night.morning,
      settings,
      fortune: original.fortune,
      loadMorning: async (signal, id): Promise<Morning> => {
        if (!night.getRecord().morningOpen) {
          await original.clock.load(signal);
          return {
            night: null,
            counted_sheep: null,
            candidate_cards: [],
            default_card_id: null,
            adoption: null,
          };
        }
        const value = await night.morning.loadMorning(signal, id);
        if (scenario === 'morning-retry' && !morningFailed) {
          morningFailed = true;
          throw new ApiError('network');
        }
        return value;
      },
    },
  };
  return {
    home,
    night,
    navigation: createNightMorningNavigation(),
    advanceMorning: () => {
      if (advanced) return;
      night.advanceMorning();
      advanced = true;
      base = Date.parse('2026-11-17T04:00:00+09:00');
      started = performance.now();
    },
  };
}

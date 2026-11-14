import { createMockMorning } from './morning';
import {
  createMockSettings,
  createSettingsWorryRecords,
  type SettingsScenario,
} from './settings';
export function createSettingsMorning(scenario: SettingsScenario = 'success') {
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
  return {
    ...base,
    settings: {
      ...createMockSettings(scenario, records),
      deletions: base.worries,
    },
  };
}

import { createMockBirthDate } from './birthDate';
import { createSettingsMorning } from './settingsMorning';
export type BirthDateFlowScenario =
  | 'success'
  | 'exhausted'
  | 'lost-response'
  | 'conflict'
  | 'slow'
  | 'profile-retry'
  | 'fortune-retry';
export function createBirthDateMorning(
  scenario: BirthDateFlowScenario = 'success',
) {
  return createSettingsMorning('success', {
    birthDate: createMockBirthDate(
      scenario === 'profile-retry' || scenario === 'fortune-retry'
        ? 'success'
        : scenario,
    ),
    profileRefreshFailure: scenario === 'profile-retry',
    fortuneRefreshFailure: scenario === 'fortune-retry',
  });
}

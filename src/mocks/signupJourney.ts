import { createMockMultiNightJourney } from './multiNightJourney';
import { homePhase } from '../features/home/model';
import { kstDate } from '../features/birthDate/date';
import { createMockSignupOnboarding } from './signupOnboarding';
import type { SignupHomeContext } from './signupOnboarding';
/** One registration, dated nights and mornings; discarded with this preview. */
export function createMockSignupJourney(
  reminder: SignupHomeContext['reminder'],
  phase: 'day' | 'night' | 'slow' = 'day',
) {
  let base = Date.parse(
      phase === 'night'
        ? '2026-11-16T21:30:00+09:00'
        : '2026-11-16T14:20:00+09:00',
    ),
    started = performance.now();
  const now = () => base + performance.now() - started;
  const advanceTo = (date: string) => {
    const target = Date.parse(date);
    if (now() >= target) return;
    base = target;
    started = performance.now();
  };
  const clock = {
    now,
    advanceMorning: (nightDate: string) =>
      advanceTo(
        new Date(
          Date.parse(`${nightDate}T04:00:00+09:00`) + 86400000,
        ).toISOString(),
      ),
  };
  let journey: ReturnType<typeof createMockMultiNightJourney> | null = null;
  const source = createMockSignupOnboarding(reminder, phase, {
    now,
    createHome: (context) => {
      journey = createMockMultiNightJourney({ ...context, clock });
      return journey.home;
    },
  });
  return {
    ...source,
    getJourney: () => journey,
    advanceNight: () => {
      if (homePhase(now()) === 'day')
        advanceTo(`${kstDate(new Date(now()))}T21:00:00+09:00`);
    },
  };
}

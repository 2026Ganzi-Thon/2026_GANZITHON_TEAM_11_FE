import { createMockHomeJourney } from './homeJourney';
import { createMockSignupOnboarding } from './signupOnboarding';
import type { SignupHomeContext } from './signupOnboarding';
/** One registration, first night and next morning; discarded with this preview. */
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
    advanceMorning: () => advanceTo('2026-11-17T04:00:00+09:00'),
  };
  let journey: ReturnType<typeof createMockHomeJourney> | null = null;
  const source = createMockSignupOnboarding(reminder, phase, {
    now,
    createHome: (context) => {
      journey = createMockHomeJourney('success', { ...context, clock });
      return journey.home;
    },
  });
  return {
    ...source,
    getJourney: () => journey,
    advanceNight: () => advanceTo('2026-11-16T21:00:00+09:00'),
  };
}

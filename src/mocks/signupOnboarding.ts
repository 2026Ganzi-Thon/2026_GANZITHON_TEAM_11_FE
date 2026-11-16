import { ApiError } from '../api/errors';
import {
  createSignupOnboarding,
  type OnboardingReminder,
} from '../features/signup/onboarding';
import type { MockReminder } from './reminder';
import { createMockBirthDate } from './birthDate';
import { createMockHome } from './firstNightHome';
import { createMockSignup } from './signup';
export function createMockSignupOnboarding(
  reminder: MockReminder & OnboardingReminder,
  phase: 'day' | 'night' | 'slow' = 'day',
) {
  const started = performance.now(),
    base = Date.parse(
      phase !== 'night'
        ? '2026-11-16T14:20:00+09:00'
        : '2026-11-16T21:30:00+09:00',
    ),
    now = () => base + performance.now() - started;
  const connected =
    phase !== 'slow'
      ? reminder
      : {
          ...reminder,
          save: async (
            target: Parameters<OnboardingReminder['save']>[0],
            signal: AbortSignal,
          ) => {
            await new Promise<void>((resolve, reject) => {
              if (signal.aborted) {
                reject(new ApiError('aborted'));
                return;
              }
              const abort = () => {
                clearTimeout(timer);
                signal.removeEventListener('abort', abort);
                reject(new ApiError('aborted'));
              };
              const timer = setTimeout(() => {
                signal.removeEventListener('abort', abort);
                resolve();
              }, 5000);
              signal.addEventListener('abort', abort, { once: true });
            });
            return reminder.save(target, signal);
          },
        };
  return {
    signup: createMockSignup(),
    onboarding: createSignupOnboarding(connected, (identity, birth) =>
      createMockHome('day', {
        identity,
        now,
        reminder,
        birthDate: createMockBirthDate('success', () => new Date(now()), birth),
      }),
    ),
  };
}

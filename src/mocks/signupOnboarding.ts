import { ApiError } from '../api/errors';
import {
  createSignupOnboarding,
  type OnboardingReminder,
} from '../features/signup/onboarding';
import type { HomeSource } from '../features/home/types';
import type { SignupActions, Registration } from '../features/signup/types';
import type { MockReminder } from './reminder';
import { createMockBirthDate, type MockBirthDate } from './birthDate';
import { createMockHome } from './firstNightHome';
import { createMockSignup } from './signup';
export interface SignupHomeContext {
  identity: Registration;
  birthDate: MockBirthDate;
  reminder: MockReminder & OnboardingReminder;
  now: () => number;
}
export interface SignupOnboardingOptions {
  signup?: SignupActions;
  now?: () => number;
  createHome?: (context: SignupHomeContext) => HomeSource;
}
export function createMockSignupOnboarding(
  reminder: MockReminder & OnboardingReminder,
  phase: 'day' | 'night' | 'slow' = 'day',
  options: SignupOnboardingOptions = {},
) {
  const started = performance.now(),
    base = Date.parse(
      phase !== 'night'
        ? '2026-11-16T14:20:00+09:00'
        : '2026-11-16T21:30:00+09:00',
    ),
    now = options.now ?? (() => base + performance.now() - started);
  const createHome =
    options.createHome ??
    ((context: SignupHomeContext) => createMockHome('day', context));
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
    signup: options.signup ?? createMockSignup('success', now),
    onboarding: createSignupOnboarding(connected, (identity, birth) =>
      createHome({
        identity: { ...identity },
        now,
        reminder,
        birthDate: createMockBirthDate('success', () => new Date(now()), birth),
      }),
    ),
  };
}

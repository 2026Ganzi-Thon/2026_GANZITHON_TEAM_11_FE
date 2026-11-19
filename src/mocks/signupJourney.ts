import type { ReceivedYarnScenario } from './receivedYarn';
import { ApiError } from '../api/errors';
import { createMockAccountScope } from './accountScope';
import { createMockSignup } from './signup';
import type { WithdrawalActions } from '../features/withdrawal/types';
import { createMockMultiNightJourney } from './multiNightJourney';
import { homePhase } from '../features/home/model';
import { kstDate } from '../features/birthDate/date';
import { createMockSignupOnboarding } from './signupOnboarding';
import type { SignupHomeContext } from './signupOnboarding';
/** One registration, dated nights and mornings; discarded with this preview. */
export function createMockSignupJourney(
  reminder: SignupHomeContext['reminder'],
  phase: 'day' | 'night' | 'slow' = 'day',
  options: {
    withdrawalScenario?: 'success' | 'retry' | 'slow';
    receivedYarnScenario?: ReceivedYarnScenario;
    startAt?: number;
  } = {},
) {
  let base =
      options.startAt ??
      Date.parse(
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
  let version = 0;
  const listeners = new Set<() => void>();
  function createAccount() {
    const generation = version;
    let journey: ReturnType<typeof createMockMultiNightJourney> | null = null;
    let loginEmail: string | null = null;
    let failed = false,
      busy = false;
    const withdrawal: WithdrawalActions = {
      withdraw: async (signal) => {
        if (generation !== version)
          throw new ApiError('http', {
            status: 410,
            code: 'ACCOUNT_WITHDRAWN',
          });
        if (busy)
          throw new ApiError('http', {
            status: 409,
            code: 'REQUEST_IN_PROGRESS',
          });
        busy = true;
        try {
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
            const timer = setTimeout(
              () => {
                signal.removeEventListener('abort', abort);
                resolve();
              },
              options.withdrawalScenario === 'slow' ? 5000 : 400,
            );
            signal.addEventListener('abort', abort, { once: true });
          });
          if (options.withdrawalScenario === 'retry' && !failed) {
            failed = true;
            throw new ApiError('network');
          }
          await reminder.save({ enabled: false, local_time: null }, signal);
          if (signal.aborted || generation !== version)
            throw new ApiError('aborted');
          const device = reminder.device.getSnapshot();
          if (device.phase !== 'ready' || device.state?.state !== 'off')
            throw new Error('Reminder cleanup not confirmed');
          account.onboarding.dispose();
          scope.revoke();
          journey = null;
          ++version;
          current = createAccount();
          listeners.forEach((listener) => listener());
        } finally {
          busy = false;
        }
      },
    };
    const scope = createMockAccountScope(withdrawal);
    const rawSignup = createMockSignup(
      'success',
      now,
      `signup-preview-account-${generation}`,
    );
    const login = rawSignup.login;
    // Keep the live date getter on the original mock action object.
    rawSignup.login = async (credentials, signal) => {
      await login(credentials, signal);
      if (signal.aborted) throw new ApiError('aborted');
      loginEmail = credentials.email;
    };
    const signup = scope.protect(rawSignup);
    const account = createMockSignupOnboarding(reminder, phase, {
      now,
      signup,
      createHome: (context) => {
        const raw = createMockMultiNightJourney({
          ...context,
          clock,
          receivedYarnScenario: options.receivedYarnScenario,
        });
        raw.home.settings!.withdrawal = withdrawal;
        raw.home.settings!.documents = { load: signup.loadDocuments };
        journey = scope.protect(raw);
        return journey.home;
      },
    });
    const guarded = scope.protect(account.onboarding);
    return {
      signup: account.signup,
      onLoginComplete: () => {
        if (generation !== version || !loginEmail) return;
        account.onboarding.restoreHome(
          { id: `login-preview-account-${generation}`, email: loginEmail },
          { birth_date: '2004-05-14', edits_remaining: 1, zodiac: 'taurus' },
        );
        loginEmail = null;
      },
      onboarding: {
        ...guarded,
        start: account.onboarding.start,
        stop: account.onboarding.stop,
        subscribe: account.onboarding.subscribe,
        getSnapshot: account.onboarding.getSnapshot,
      },
      getJourney: () => journey,
    };
  }
  let current = createAccount();
  return {
    get signup() {
      return current.signup;
    },
    get onboarding() {
      return current.onboarding;
    },
    onLoginComplete: () => current.onLoginComplete(),
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getVersion: () => version,
    getJourney: () => current.getJourney(),
    advanceNight: () => {
      if (homePhase(now()) === 'day')
        advanceTo(`${kstDate(new Date(now()))}T21:00:00+09:00`);
    },
  };
}

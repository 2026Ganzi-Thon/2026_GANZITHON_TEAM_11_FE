import type { ReceivedYarnScenario } from './receivedYarn';
import { ApiError } from '../api/errors';
import { createMockAccountScope } from './accountScope';
import { createMockSignup } from './signup';
import type { WithdrawalActions } from '../features/withdrawal/types';
import type { LogoutActions } from '../features/auth/logout';
import type { Reminder } from '../features/reminder/types';
import { createMockMultiNightJourney } from './multiNightJourney';
import { homePhase } from '../features/home/model';
import { kstDate } from '../features/birthDate/date';
import { createMockSignupOnboarding } from './signupOnboarding';
import type { SignupHomeContext } from './signupOnboarding';
type Journey = ReturnType<typeof createMockMultiNightJourney>;
interface StoredAccount {
  journey: Journey;
  reminder: Reminder;
}
const emailKey = (email: string) => email.trim().toLowerCase();
/** Memory-only accounts. No credentials or authentication tokens are retained. */
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
  const accounts = new Map<string, StoredAccount>();
  function createAccount(initialLoginEmail?: string) {
    const generation = version;
    let journey: ReturnType<typeof createMockMultiNightJourney> | null = null;
    let loginEmail: string | null = null;
    let loginAttempt = 0;
    let stored: StoredAccount | null = null;
    let storedEmail: string | null = null;
    let logoutPreference: Reminder | null = null;
    let failed = false,
      busy = false;
    async function close(signal: AbortSignal, remove: boolean) {
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
      if (signal.aborted) throw new ApiError('aborted');
      if (!remove) logoutPreference ??= reminder.readSnapshot();
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
            remove && options.withdrawalScenario === 'slow' ? 5000 : 400,
          );
          signal.addEventListener('abort', abort, { once: true });
        });
        if (remove && options.withdrawalScenario === 'retry' && !failed) {
          failed = true;
          throw new ApiError('network');
        }
        await reminder.save({ enabled: false, local_time: null }, signal);
        if (signal.aborted || generation !== version)
          throw new ApiError('aborted');
        const device = reminder.device.getSnapshot();
        if (device.phase !== 'ready' || device.state?.state !== 'off')
          throw new Error('Reminder cleanup not confirmed');
        if (!remove && stored) {
          stored.reminder = logoutPreference!;
          stored.journey.clearTransient();
        }
        if (remove && storedEmail) accounts.delete(storedEmail);
        account.onboarding.dispose();
        scope.revoke(remove ? 'ACCOUNT_WITHDRAWN' : 'SIGNED_OUT');
        journey = null;
        ++version;
        current = createAccount(
          remove ? undefined : (storedEmail ?? undefined),
        );
        listeners.forEach((listener) => listener());
      } finally {
        busy = false;
      }
    }
    const lifecycle: WithdrawalActions & LogoutActions = {
      withdraw: (signal) => close(signal, true),
      logout: (signal) => close(signal, false),
    };
    const scope = createMockAccountScope(lifecycle);
    const rawSignup = createMockSignup(
      'success',
      now,
      `signup-preview-account-${generation}`,
    );
    const login = rawSignup.login;
    const register = rawSignup.register;
    rawSignup.register = (key, credentials, signal) => {
      if (accounts.has(emailKey(credentials.email)))
        return Promise.reject(
          new ApiError('http', { status: 409, code: 'EMAIL_ALREADY_USED' }),
        );
      return register(
        key,
        { ...credentials, email: emailKey(credentials.email) },
        signal,
      );
    };
    // Keep the live date getter on the original mock action object.
    rawSignup.login = async (credentials, signal) => {
      const attempt = ++loginAttempt;
      loginEmail = null;
      let restoring = false;
      try {
        await login(credentials, signal);
        if (signal.aborted) throw new ApiError('aborted');
        const email = emailKey(credentials.email);
        const target = accounts.get(email)?.reminder ?? {
          enabled: false,
          local_time: null,
        };
        restoring = true;
        await reminder.save(target, signal);
        if (
          signal.aborted ||
          generation !== version ||
          attempt !== loginAttempt
        )
          throw new ApiError('aborted');
        loginEmail = email;
      } catch (error) {
        // A cancelled screen may have committed the preference before native work
        // returned. Queue OFF after that work; a newer login owns its own setting.
        if (
          restoring &&
          signal.aborted &&
          generation === version &&
          attempt === loginAttempt
        ) {
          await reminder.save(
            { enabled: false, local_time: null },
            new AbortController().signal,
          );
        }
        throw error;
      }
    };
    const signup = scope.protect(rawSignup);
    const account = createMockSignupOnboarding(reminder, phase, {
      now,
      signup,
      createHome: (context) => {
        storedEmail = emailKey(context.identity.email);
        const existing = accounts.get(storedEmail);
        const raw =
          existing?.journey ??
          createMockMultiNightJourney({
            ...context,
            identity: { ...context.identity, email: storedEmail },
            clock,
            receivedYarnScenario: options.receivedYarnScenario,
          });
        stored = existing ?? {
          journey: raw,
          reminder: reminder.readSnapshot(),
        };
        accounts.set(storedEmail, stored);
        raw.home.settings!.withdrawal = lifecycle;
        raw.home.settings!.logout = lifecycle;
        raw.home.settings!.reminder = {
          ...reminder,
          save: (target, signal) => {
            // A fresh settings edit supersedes a previously failed logout's
            // captured preference; an immediate logout retry still reuses it.
            logoutPreference = null;
            return reminder.save(target, signal);
          },
        };
        raw.home.settings!.documents = { load: signup.loadDocuments };
        journey = scope.protect(raw);
        return journey.home;
      },
    });
    const guarded = scope.protect(account.onboarding);
    return {
      initialLoginEmail,
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
    get initialLoginEmail() {
      return current.initialLoginEmail;
    },
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

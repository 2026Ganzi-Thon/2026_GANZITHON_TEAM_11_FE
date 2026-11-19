import { PREVIEW_LEGAL_REVISION } from '../features/legal/previewPolicy';
import { hasRequiredConsents } from '../features/legal/model';
import { exampleLegalDocuments } from './legalDocuments';
import { createMockPasswordReset } from './passwordReset';
import { ApiError } from '../api/errors';
import { birthDateError, kstDate, parseDate } from '../features/birthDate/date';
import {
  type Registration,
  type SignupActions,
} from '../features/signup/types';
import type { BirthDateResult } from '../features/birthDate/types';
import { previewZodiac } from '../features/birthDate/zodiac';
export type SignupScenario =
  | 'success'
  | 'register-retry'
  | 'register-lost'
  | 'register-in-progress'
  | 'birth-in-progress'
  | 'email-used'
  | 'documents-retry'
  | 'consent-retry'
  | 'version-changed'
  | 'birth-retry'
  | 'age-rejected'
  | 'slow';
/** In-memory UI adapter; recovery keys and extra choices are not agreed HTTP fields. */
export function createMockSignup(
  scenario: SignupScenario = 'success',
  now: () => number = () => Date.parse('2026-11-16T12:00:00+09:00'),
  accountId = 'signup-preview-account',
): SignupActions {
  const today = () => kstDate(new Date(now()));
  let revision = PREVIEW_LEGAL_REVISION,
    account: Registration | null = null,
    birth: BirthDateResult | null = null,
    agreed = false;
  const operations = new Map<string, Registration>(),
    failed = new Set<string>();
  const failOnce = (name: string) => {
    if (!failed.has(name)) {
      failed.add(name);
      throw new ApiError('network');
    }
  };
  function delayed<T>(signal: AbortSignal, action: () => T): Promise<T> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new ApiError('aborted'));
        return;
      }
      const cleanup = () => {
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
      };
      const abort = () => {
        cleanup();
        reject(new ApiError('aborted'));
      };
      const timer = setTimeout(
        () => {
          cleanup();
          try {
            resolve(action());
          } catch (e) {
            reject(e);
          }
        },
        scenario === 'slow' ? 5000 : 500,
      );
      signal.addEventListener('abort', abort, { once: true });
    });
  }
  return {
    passwordReset: createMockPasswordReset(
      scenario === 'slow' ? 'slow' : 'success',
    ),
    get today() {
      return today();
    },
    loadDocuments: (signal) =>
      delayed(signal, () => {
        if (scenario === 'documents-retry') failOnce('docs');
        return exampleLegalDocuments(revision);
      }),
    register: (key, credentials, signal) =>
      delayed(signal, () => {
        if (operations.has(key)) {
          const found = operations.get(key)!;
          if (found.email !== credentials.email)
            throw new ApiError('http', {
              status: 409,
              code: 'OPERATION_CONFLICT',
            });
          return { ...found };
        }
        if (scenario === 'email-used' || account)
          throw new ApiError('http', {
            status: 409,
            code: 'EMAIL_ALREADY_USED',
          });
        if (scenario === 'register-retry') failOnce('register');
        account = { id: accountId, email: credentials.email };
        operations.set(key, { ...account });
        if (scenario === 'register-lost') failOnce('lost');
        if (scenario === 'register-in-progress')
          throw new ApiError('http', {
            status: 409,
            code: 'REQUEST_IN_PROGRESS',
          });
        return { ...account };
      }),
    consent: (id, input, signal) =>
      delayed(signal, () => {
        if (id !== account?.id) throw new ApiError('http', { status: 404 });
        if (scenario === 'version-changed' && !failed.has('version')) {
          failed.add('version');
          revision = `${PREVIEW_LEGAL_REVISION}-updated`;
          throw new ApiError('http', {
            status: 409,
            code: 'CONSENT_VERSION_CHANGED',
          });
        }
        if (input.revision !== revision)
          throw new ApiError('http', {
            status: 409,
            code: 'CONSENT_VERSION_CHANGED',
          });
        if (!hasRequiredConsents(input.choices))
          throw new ApiError('http', { status: 422 });
        if (scenario === 'consent-retry') failOnce('consent');
        agreed = true;
      }),
    birth: (id, date, signal) =>
      delayed(signal, () => {
        if (id !== account?.id || !agreed)
          throw new ApiError('http', { status: 409 });
        const parts = parseDate(date);
        if (!parts || birthDateError(parts, today()))
          throw new ApiError('http', { status: 422 });
        if (scenario === 'age-rejected')
          throw new ApiError('http', { status: 422, code: 'AGE_NOT_ALLOWED' });
        if (birth && birth.birth_date !== date)
          throw new ApiError('http', {
            status: 409,
            code: 'PROFILE_ALREADY_COMPLETED',
          });
        if (birth) return { ...birth };
        if (scenario === 'birth-retry') failOnce('birth');
        birth = {
          birth_date: date,
          edits_remaining: 1,
          zodiac: previewZodiac(date),
        };
        if (scenario === 'birth-in-progress')
          throw new ApiError('http', {
            status: 409,
            code: 'REQUEST_IN_PROGRESS',
          });
        return { ...birth };
      }),
    login: (_credentials, signal) => delayed(signal, () => undefined),
  };
}

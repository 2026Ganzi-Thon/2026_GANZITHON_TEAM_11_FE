import type { PasswordResetActions } from '../features/auth/passwordReset/model';
import { ApiError } from '../api/errors';
export type PasswordResetScenario =
  | 'success'
  | 'unknown-email'
  | 'network-once'
  | 'slow'
  | 'limited-seconds'
  | 'limited-date'
  | 'invalid-response'
  | 'validation';
/** No account lookup, outbound mail, tokens or persisted addresses. */
export function createMockPasswordReset(
  scenario: PasswordResetScenario = 'success',
): PasswordResetActions {
  let failed = false,
    until = 0;
  return {
    request: (_email, signal) =>
      new Promise((resolve, reject) => {
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
            if (scenario === 'network-once' && !failed) {
              failed = true;
              reject(new ApiError('network'));
              return;
            }
            if (scenario === 'validation') {
              reject(
                new ApiError('http', {
                  status: 422,
                  code: 'VALIDATION_ERROR',
                  fields: { email: 'invalid' },
                }),
              );
              return;
            }
            if (scenario === 'limited-seconds' || scenario === 'limited-date') {
              if (!failed) {
                failed = true;
                until = Math.ceil((Date.now() + 3000) / 1000) * 1000;
              }
              if (Date.now() < until) {
                reject(
                  new ApiError('http', {
                    status: 429,
                    retryAfter:
                      scenario === 'limited-date'
                        ? new Date(until).toUTCString()
                        : String(Math.ceil((until - Date.now()) / 1000)),
                  }),
                );
                return;
              }
            }
            resolve({ accepted: scenario !== 'invalid-response' });
          },
          scenario === 'slow' ? 5000 : 400,
        );
        signal.addEventListener('abort', abort, { once: true });
      }),
  };
}

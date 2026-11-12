import type { LoginSubmit } from '../features/auth/LoginScreen';
import { ApiError } from '../api/errors';
export type LoginScenario = 'success' | 'invalid' | 'network';
/** UI preview only. Never sends or persists credentials; returns no tokens. */
export function createMockLogin(scenario: LoginScenario): LoginSubmit {
  return (_credentials, signal) =>
    new Promise<void>((resolve, reject) => {
      if (signal.aborted) {
        reject(new ApiError('aborted'));
        return;
      }
      const cleanup = () => {
        clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
      };
      const onAbort = () => {
        cleanup();
        reject(new ApiError('aborted'));
      };
      const timer = setTimeout(() => {
        cleanup();
        if (scenario === 'invalid')
          reject(
            new ApiError('http', { status: 401, code: 'INVALID_CREDENTIALS' }),
          );
        else if (scenario === 'network') reject(new ApiError('network'));
        else resolve();
      }, 800);
      signal.addEventListener('abort', onAbort, { once: true });
    });
}

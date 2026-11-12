import { ApiError } from '../api/errors';
import type { NightEntryActions } from '../features/night/entry';
export type NightEntryScenario = 'success' | 'worry-retry' | 'count-retry';
/** Preview only: consumes no draft data and performs no network or storage access. */
export function createMockNightEntry(
  scenario: NightEntryScenario,
): NightEntryActions {
  let failedOnce = false;
  const respond = (step: 'worry' | 'count', signal: AbortSignal) =>
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
        if (!failedOnce && scenario === `${step}-retry`) {
          failedOnce = true;
          reject(new ApiError('network'));
        } else resolve();
      }, 800);
      signal.addEventListener('abort', onAbort, { once: true });
    });
  return {
    checkWorry: (_draft, signal) => respond('worry', signal),
    startCounting: (_count, signal) => respond('count', signal),
  };
}

import { ApiError } from '../api/errors';
import type {
  ReceivedYarnActions,
  ReceivedYarnSummary,
} from '../features/yarnSummary/types';
export type ReceivedYarnScenario =
  | 'success'
  | 'none'
  | 'zero'
  | 'seen'
  | 'load-retry'
  | 'seen-retry'
  | 'seen-lost'
  | 'slow-load'
  | 'slow-seen'
  | 'large';
/** One owner/date in memory. No reaction aggregation or notification delivery. */
export function createMockReceivedYarn(
  scenario: ReceivedYarnScenario = 'success',
): ReceivedYarnActions {
  const summary: ReceivedYarnSummary = {
    id: 'preview-yarn-summary',
    date: '2026-11-13',
    yarn_count: scenario === 'zero' ? 0 : scenario === 'large' ? 1234567 : 3,
    sender_count: scenario === 'zero' ? 0 : scenario === 'large' ? 123456 : 2,
  };
  let seen = scenario === 'seen';
  const failures = new Set<string>();
  function delayed<T>(
    signal: AbortSignal,
    action: () => T,
    ms: number,
  ): Promise<T> {
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
      const timer = setTimeout(() => {
        cleanup();
        try {
          resolve(action());
        } catch (error) {
          reject(error);
        }
      }, ms);
      signal.addEventListener('abort', abort, { once: true });
    });
  }
  const failOnce = (key: string) => {
    if (!failures.has(key)) {
      failures.add(key);
      throw new ApiError('network');
    }
  };
  return {
    load: (signal) =>
      delayed(
        signal,
        () => {
          if (scenario === 'load-retry') failOnce('load');
          return seen || scenario === 'none' ? null : { ...summary };
        },
        scenario === 'slow-load' ? 5000 : 400,
      ),
    markSeen: (id, signal) =>
      delayed(
        signal,
        () => {
          if (id !== summary.id || scenario === 'none')
            throw new ApiError('http', {
              status: 404,
              code: 'YARN_SUMMARY_NOT_FOUND',
            });
          if (scenario === 'seen-retry') failOnce('seen');
          seen = true;
          if (scenario === 'seen-lost') failOnce('lost');
        },
        scenario === 'slow-seen' ? 5000 : 400,
      ),
  };
}

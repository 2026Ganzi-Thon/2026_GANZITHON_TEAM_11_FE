import { ApiError } from '../api/errors';
import { createWorryDeletions } from '../features/worries/deletions';
export type WorryDeletionScenario =
  'success' | 'retry' | 'lost-response' | 'slow';
/** In-memory DELETE sample, including an uncertain response after committing. */
export function createMockWorryDeletion(
  erase: (nightId: string) => void,
  scenario: WorryDeletionScenario = 'success',
) {
  let failed = false;
  return createWorryDeletions({
    remove: (nightId, signal) =>
      new Promise<void>((resolve, reject) => {
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
              if (scenario === 'retry' && !failed) {
                failed = true;
                throw new ApiError('network');
              }
              erase(nightId);
              if (scenario === 'lost-response' && !failed) {
                failed = true;
                throw new ApiError('network');
              }
              resolve();
            } catch (error) {
              reject(error);
            }
          },
          scenario === 'slow' ? 5000 : 600,
        );
        signal.addEventListener('abort', abort, { once: true });
      }),
  });
}

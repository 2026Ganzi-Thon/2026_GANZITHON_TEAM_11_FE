import { ApiError } from '../api/errors';
import type { RecordDeletionActions } from '../features/worries/recordDeletion';
import type { MockWorryRecords } from './worryRecords';
import type { WorryDeletionScenario } from './worryDeletion';
export function createMockRecordDeletion(
  records: MockWorryRecords,
  scenario: WorryDeletionScenario,
): RecordDeletionActions {
  let failed = false,
    checkFailed = false;
  function respond<T>(signal: AbortSignal, action: () => T): Promise<T> {
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
          } catch (error) {
            reject(error);
          }
        },
        scenario === 'slow' ? 5000 : 600,
      );
      signal.addEventListener('abort', abort, { once: true });
    });
  }
  return {
    remove: (id, signal) =>
      respond(signal, () => {
        if (
          (scenario === 'retry' ||
            (scenario === 'partial' && id === 'preview-earlier-0')) &&
          !failed
        ) {
          failed = true;
          throw new ApiError('network');
        }
        records.eraseRecord(id);
        if (
          (scenario === 'lost-response' || scenario === 'check-retry') &&
          !failed
        ) {
          failed = true;
          throw new ApiError('network');
        }
      }),
    check: (id, signal) =>
      respond(signal, () => {
        if (scenario === 'check-retry' && !checkFailed) {
          checkFailed = true;
          throw new ApiError('network');
        }
        return records.isRecordDeleted(id);
      }),
  };
}

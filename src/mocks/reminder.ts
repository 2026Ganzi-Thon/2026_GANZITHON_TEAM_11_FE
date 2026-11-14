import { ApiError } from '../api/errors';
import { validReminder } from '../features/reminder/time';
import type {
  Reminder,
  ReminderActions,
  ReminderPermission,
} from '../features/reminder/types';
export type ReminderScenario =
  | 'success'
  | 'enabled'
  | 'denied'
  | 'undetermined'
  | 'permission-retry'
  | 'load-retry'
  | 'save-retry'
  | 'lost-response'
  | 'slow'
  | 'invalid-response'
  | 'validation';
export interface MockReminder extends ReminderActions {
  readSnapshot(): Reminder;
}
export function createMockReminder(
  scenario: ReminderScenario = 'success',
): MockReminder {
  let stored: Reminder =
    scenario === 'enabled'
      ? { enabled: true, local_time: '23:30' }
      : { enabled: false, local_time: null };
  const failed = new Set<string>();
  function delayed<T>(
    signal: AbortSignal,
    operation: string,
    action: () => T,
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
      const timer = setTimeout(
        () => {
          cleanup();
          try {
            if (
              ((scenario === 'load-retry' && operation === 'load') ||
                (scenario === 'save-retry' && operation === 'save') ||
                (scenario === 'permission-retry' &&
                  operation === 'permission')) &&
              !failed.has(operation)
            ) {
              failed.add(operation);
              throw new ApiError('network');
            }
            resolve(action());
          } catch (error) {
            reject(error);
          }
        },
        scenario === 'slow' && operation === 'save' ? 5000 : 300,
      );
      signal.addEventListener('abort', abort, { once: true });
    });
  }
  return {
    readSnapshot: () => ({ ...stored }),
    load: (signal) => delayed(signal, 'load', () => ({ ...stored })),
    readPermission: (signal) =>
      delayed<ReminderPermission>(signal, 'permission', () =>
        scenario === 'denied'
          ? 'denied'
          : scenario === 'undetermined'
            ? 'undetermined'
            : 'granted',
      ),
    save: (target, signal) => {
      // Snapshot the PUT body before the asynchronous boundary.
      const input = { ...target };
      return delayed(signal, 'save', () => {
        if (!validReminder(input))
          throw new ApiError('http', { status: 422, code: 'VALIDATION_ERROR' });
        if (scenario === 'validation' && !failed.has('validation')) {
          failed.add('validation');
          throw new ApiError('http', { status: 422, code: 'VALIDATION_ERROR' });
        }
        stored = { ...input };
        if (scenario === 'lost-response' && !failed.has('lost')) {
          failed.add('lost');
          throw new ApiError('network');
        }
        if (scenario === 'invalid-response' && !failed.has('invalid')) {
          failed.add('invalid');
          return { enabled: true, local_time: '25:00' };
        }
        return { ...stored };
      });
    },
  };
}

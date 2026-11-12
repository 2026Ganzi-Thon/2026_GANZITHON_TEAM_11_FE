import { ApiError } from '../api/errors';
import type {
  ClosingActions,
  ClosingRequest,
  ClosingResult,
} from '../features/night/closing/types';
export type ClosingScenario =
  | 'success'
  | 'finish-lost'
  | 'view-retry'
  | 'choice-retry'
  | 'unavailable'
  | 'offered-before';
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
    const timer = setTimeout(() => {
      cleanup();
      try {
        resolve(action());
      } catch (error) {
        reject(error);
      }
    }, 600);
    signal.addEventListener('abort', abort, { once: true });
  });
}
function validate(input: ClosingRequest) {
  const { position, furthestPosition, sheepCount, reason } = input;
  if (
    ![position, furthestPosition, sheepCount].every(Number.isInteger) ||
    sheepCount < 3 ||
    sheepCount > 30 ||
    position < 1 ||
    position > furthestPosition ||
    furthestPosition > sheepCount ||
    (reason === 'completed' && position !== sheepCount)
  )
    throw new Error('Invalid preview finish position.');
}
/** Memory-only response replay for exercising UI retries, not server idempotency. */
export function createMockNightClosing(
  scenario: ClosingScenario = 'success',
): ClosingActions {
  const finished = new Map<
    string,
    { fingerprint: string; result: ClosingResult }
  >();
  const once = new Set<string>();
  const failOnce = (kind: string) => {
    if (!once.has(kind)) {
      once.add(kind);
      throw new ApiError('network');
    }
  };
  return {
    finish: (input, key, signal) =>
      delayed(signal, () => {
        validate(input);
        const fingerprint = JSON.stringify(input);
        const saved = finished.get(key);
        if (saved) {
          if (saved.fingerprint !== fingerprint)
            throw new Error('Preview operation changed.');
          return saved.result;
        }
        const result: ClosingResult = {
          summary: {
            counted: input.furthestPosition,
            entrusted_count: 0,
            fluff_count: 0,
          },
          closing_card:
            input.reason === 'completed'
              ? null
              : {
                  id: 'preview-closing-warm',
                  kind: 'text',
                  tone: 'warm',
                  category_id: null,
                  author_type: 'seed',
                  author_label: '먼저 지나간 양',
                  available: scenario !== 'unavailable',
                  content:
                    scenario === 'unavailable'
                      ? null
                      : {
                          text: '오늘은 여기까지 해도 괜찮아.\n남은 밤은 편안히 쉬어.',
                        },
                  viewer: {
                    yarn_sent: false,
                    fluff_saved: false,
                    song_saved: false,
                  },
                },
          writing_offer: {
            state: scenario === 'offered-before' ? 'fulfilled' : 'offered',
          },
        };
        finished.set(key, { fingerprint, result });
        if (scenario === 'finish-lost') failOnce('finish');
        return result;
      }),
    markViewed: (_cardId, _key, signal) =>
      delayed(signal, () => {
        if (scenario === 'view-retry') failOnce('view');
      }),
    chooseWriting: (_choice, _key, signal) =>
      delayed(signal, () => {
        if (scenario === 'choice-retry') failOnce('choice');
      }),
  };
}

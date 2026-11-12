import type { Card } from '../api/contracts';
import { ApiError } from '../api/errors';
import type { YarnActions } from '../features/yarn/types';
import { createMockNightFeed } from './nightFeed';
export type YarnScenario =
  | 'success'
  | 'slow'
  | 'retry'
  | 'remove-retry'
  | 'unavailable'
  | 'lost-response'
  | 'offline';
/** Assigned-card target-state fixture only; no recipient delivery or aggregation. */
export function createMockYarn(
  getCards: () => readonly Card[],
  scenario: YarnScenario = 'success',
): YarnActions {
  const failed = new Set<string>();
  return {
    set(id, sent, signal) {
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
              const card = getCards().find((c) => c.id === id);
              if (!card)
                throw new ApiError('http', {
                  status: 404,
                  code: 'NOT_FOUND',
                });
              if (typeof sent !== 'boolean')
                throw new ApiError('http', {
                  status: 422,
                  code: 'VALIDATION_ERROR',
                });
              if (scenario === 'unavailable') {
                card.available = false;
                card.content = null;
              }
              if (!card.available || !card.content)
                throw new ApiError('http', {
                  status: 409,
                  code: 'CARD_UNAVAILABLE',
                });
              const key = id + ':' + sent;
              if (scenario === 'offline') throw new ApiError('network');
              if (
                ((scenario === 'retry' && sent) ||
                  (scenario === 'remove-retry' && !sent)) &&
                !failed.has(key)
              ) {
                failed.add(key);
                throw new ApiError('network');
              }
              card.viewer.yarn_sent = sent;
              if (scenario === 'lost-response' && !failed.has(id)) {
                failed.add(id);
                throw new ApiError('network');
              }
              resolve({ card_id: id, sent });
            } catch (error) {
              reject(error);
            }
          },
          scenario === 'slow' ? 5000 : 400,
        );
        signal.addEventListener('abort', abort, { once: true });
      });
    },
  };
}
export function createYarnPreview(
  scenario: YarnScenario = 'success',
  long = false,
) {
  let cards: Card[] | null = null;
  const source = createMockNightFeed(6, long ? 'long' : 'success');
  return {
    load: async (signal: AbortSignal) => {
      if (signal.aborted) throw new ApiError('aborted');
      if (cards) return cards;
      const loaded = await source(signal);
      if (signal.aborted) throw new ApiError('aborted');
      cards = loaded;
      if (scenario === 'remove-retry') cards[0].viewer.yarn_sent = true;
      return cards;
    },
    yarn: createMockYarn(() => cards ?? [], scenario),
  };
}

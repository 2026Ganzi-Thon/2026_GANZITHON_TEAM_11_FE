import type { Card } from '../api/contracts';
import { ApiError } from '../api/errors';
import type { FluffActions } from '../features/fluff/types';
import { createMockNightFeed } from './nightFeed';
import { createMockYarn } from './yarn';
export type FluffScenario =
  | 'success'
  | 'slow'
  | 'retry'
  | 'remove-retry'
  | 'lost-response'
  | 'offline'
  | 'unavailable'
  | 'closed';
export function createMockFluff(
  context: {
    cards: () => readonly Card[];
    viewed: (id: string) => boolean;
    isOpen: () => boolean;
  },
  scenario: FluffScenario = 'success',
): FluffActions {
  const failed = new Set<string>();
  return {
    set(id, saved, signal) {
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
              const rejectCode = (status: number, code: string): never => {
                throw new ApiError('http', { status, code });
              };
              const card = context.cards().find((c) => c.id === id);
              if (!card) rejectCode(404, 'NOT_FOUND');
              if (typeof saved !== 'boolean')
                rejectCode(422, 'VALIDATION_ERROR');
              if (!context.isOpen() || scenario === 'closed')
                rejectCode(409, 'NIGHT_CLOSED');
              if (!context.viewed(id)) rejectCode(422, 'CARD_NOT_VIEWED');
              if (scenario === 'unavailable') {
                card!.available = false;
                card!.content = null;
                card!.viewer.fluff_saved = false;
              }
              if (!card!.available || !card!.content)
                rejectCode(409, 'CARD_UNAVAILABLE');
              if (scenario === 'offline') throw new ApiError('network');
              const key = id + ':' + saved;
              if (
                ((scenario === 'retry' && saved) ||
                  (scenario === 'remove-retry' && !saved)) &&
                !failed.has(key)
              ) {
                failed.add(key);
                throw new ApiError('network');
              }
              for (const item of context.cards())
                if (item.id === id) item.viewer.fluff_saved = saved;
              if (scenario === 'lost-response' && !failed.has(id)) {
                failed.add(id);
                throw new ApiError('network');
              }
              resolve({ card_id: id, saved });
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
export function createFluffPreview(
  scenario: FluffScenario = 'success',
  long = false,
) {
  let cards: Card[] | null = null,
    furthest = 1;
  const source = createMockNightFeed(6, long ? 'long' : 'success');
  return {
    load: async (signal: AbortSignal) => {
      if (signal.aborted) throw new ApiError('aborted');
      if (cards) return cards;
      cards = await source(signal);
      if (scenario === 'remove-retry') cards[0].viewer.fluff_saved = true;
      return cards;
    },
    progress: (next: { furthestPosition: number }) => {
      furthest = Math.max(furthest, next.furthestPosition);
    },
    fluff: createMockFluff(
      {
        cards: () => cards ?? [],
        viewed: (id) =>
          (cards ?? []).slice(0, furthest).some((c) => c.id === id),
        isOpen: () => true,
      },
      scenario,
    ),
    yarn: createMockYarn(() => cards ?? []),
  };
}

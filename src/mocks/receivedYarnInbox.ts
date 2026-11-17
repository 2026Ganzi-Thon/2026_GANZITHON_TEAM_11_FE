import { ApiError } from '../api/errors';
import { fortuneDate, homePhase } from '../features/home/model';
import type {
  ReceivedYarnActions,
  ReceivedYarnSummary,
} from '../features/yarnSummary/types';
import type { MockMyCards } from './myCards';
import type { ReceivedYarnScenario } from './receivedYarn';
interface Receipt {
  id: string;
  cardId: string;
  senderKey: string;
  receivedAt: number;
}
/** Incoming preview events only; sender keys never leave this adapter. */
export function createMockReceivedYarnInbox({
  ownerId,
  now,
  cards,
  scenario = 'success',
}: {
  ownerId: string;
  now: () => number;
  cards: MockMyCards;
  scenario?: ReceivedYarnScenario;
}) {
  const receipts = new Map<string, Receipt>(),
    pairs = new Set<string>(),
    seen = new Set<string>(),
    presented = new Set<string>(),
    failed = new Set<string>();
  const ports = new Map<string, ReceivedYarnActions>();
  const failOnce = (key: string) => {
    if (!failed.has(key)) {
      failed.add(key);
      throw new ApiError('network');
    }
  };
  function read(date: string): ReceivedYarnSummary | null {
    if (fortuneDate(now()) !== date) return null;
    const end = Date.parse(`${date}T04:00:00+09:00`),
      start = end - 86400000;
    const entries = [...receipts.values()].filter(
      (r) =>
        r.receivedAt >= start &&
        r.receivedAt < end &&
        cards.readPublished(r.cardId),
    );
    return entries.length
      ? {
          id: `${ownerId}:${date}`,
          date,
          yarn_count: entries.length,
          sender_count: new Set(entries.map((r) => r.senderKey)).size,
        }
      : null;
  }
  function delayed<T>(
    signal: AbortSignal,
    action: () => T,
    slow = false,
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
            resolve(action());
          } catch (e) {
            reject(e);
          }
        },
        slow ? 5000 : 400,
      );
      signal.addEventListener('abort', abort, { once: true });
    });
  }
  return {
    receive(receipt: Receipt) {
      if (
        !receipt.id.trim() ||
        !receipt.senderKey.trim() ||
        !Number.isFinite(receipt.receivedAt)
      )
        throw new ApiError('invalid-response');
      const old = receipts.get(receipt.id);
      if (old) {
        if (
          old.cardId !== receipt.cardId ||
          old.senderKey !== receipt.senderKey ||
          old.receivedAt !== receipt.receivedAt
        )
          throw new ApiError('http', { status: 409, code: 'RECEIPT_CONFLICT' });
        return;
      }
      if (!cards.readPublished(receipt.cardId))
        throw new ApiError('http', { status: 404, code: 'CARD_NOT_PUBLISHED' });
      const pair = JSON.stringify([receipt.cardId, receipt.senderKey]);
      if (pairs.has(pair)) return;
      if (!cards.recordReceivedYarn(receipt.cardId, receipt.id)) return;
      pairs.add(pair);
      receipts.set(receipt.id, { ...receipt });
    },
    forDate(date: string, autoAllowed = true): ReceivedYarnActions {
      const parsed = new Date(`${date}T00:00:00Z`);
      if (
        !Number.isFinite(parsed.getTime()) ||
        parsed.toISOString().slice(0, 10) !== date
      )
        throw new ApiError('invalid-response');
      const key = `${date}:${autoAllowed}`;
      const cached = ports.get(key);
      if (cached) return cached;
      const load = (signal: AbortSignal, manual: boolean) =>
        delayed(
          signal,
          () => {
            if (scenario === 'load-retry') failOnce(`load:${date}`);
            if (
              !manual &&
              (!autoAllowed ||
                homePhase(now()) !== 'day' ||
                seen.has(date) ||
                presented.has(date))
            )
              return null;
            return read(date);
          },
          scenario === 'slow-load',
        );
      const actions: ReceivedYarnActions = {
        load: (signal) => load(signal, false),
        loadLatest: (signal) => load(signal, true),
        markSeen: (id, signal) => {
          // This port is called only by the modal's actual onShow. Remember
          // presentation separately from an acknowledgement that may be lost.
          if (signal.aborted) return Promise.reject(new ApiError('aborted'));
          if (fortuneDate(now()) !== date)
            return Promise.reject(
              new ApiError('http', {
                status: 409,
                code: 'YARN_SUMMARY_DATE_CHANGED',
              }),
            );
          if (id !== `${ownerId}:${date}` || !read(date))
            return Promise.reject(
              new ApiError('http', {
                status: 404,
                code: 'YARN_SUMMARY_NOT_FOUND',
              }),
            );
          presented.add(date);
          return delayed(
            signal,
            () => {
              if (fortuneDate(now()) !== date)
                throw new ApiError('http', {
                  status: 409,
                  code: 'YARN_SUMMARY_DATE_CHANGED',
                });
              if (id !== `${ownerId}:${date}` || !read(date))
                throw new ApiError('http', {
                  status: 404,
                  code: 'YARN_SUMMARY_NOT_FOUND',
                });
              if (scenario === 'seen-retry') failOnce(`seen:${date}`);
              seen.add(date);
              if (scenario === 'seen-lost') failOnce(`lost:${date}`);
            },
            scenario === 'slow-seen',
          );
        },
      };
      ports.set(key, actions);
      return actions;
    },
  };
}

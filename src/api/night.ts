import type { Bootstrap, Card } from './contracts';
import { ApiError } from './errors';
import { operationKey, type ApiSession } from './session';
import { segment, type LiveResources } from './resources';
import type {
  NightEntryActions,
  NightWorryResult,
  WorryDraft,
} from '../features/night/entry';
import type { FeedPosition } from '../features/night/feed/model';
import type {
  ClosingActions,
  ClosingResult,
} from '../features/night/closing/types';
import type {
  EntrustActions,
  EntrustAction,
} from '../features/night/entrust/types';
import type { StopOfferItem } from '../features/night/stopOffer/model';

interface Session {
  id: string;
  night_id: string;
  sheep_count: number;
  position: number;
  furthest_position: number;
  sequence: number;
  writer_epoch: number;
  closes_at: string;
}
interface Item {
  id: string;
  position: number;
  type: 'card' | 'pause';
  card?: Card;
  pause?: {
    kind: 'entrust_worry' | 'stop_offer';
    action: EntrustAction | null;
  };
}
interface Progress {
  position: number;
  furthest_position: number;
  sequence: number;
  writer_epoch: number;
}
export function createLiveNight(
  api: ApiSession,
  resources: LiveResources,
  boot: Bootstrap,
) {
  let nightId = boot.night_id,
    session: Session | null = null;
  let feed: Card[] = [],
    items: Item[] = [],
    draft: WorryDraft | null = null;
  let createWork: { key: string; count: number } | null = null;
  const resumeKey = operationKey();
  let queue: Promise<unknown> = Promise.resolve(),
    pending: Progress | null = null;
  const finishes = new Map<string, Progress & { reason: string }>();
  const path = (suffix: string) => {
    if (!session) throw new ApiError('invalid-response');
    return `/sessions/${segment(session.id)}${suffix}`;
  };
  const serial = <T>(job: () => Promise<T>): Promise<T> => {
    const next = queue.catch(() => undefined).then(job);
    queue = next;
    return next;
  };
  const loadFeed = async (signal: AbortSignal) => {
    const result = await api.request<{
      session_id: string;
      total_count: number;
      items: Item[];
    }>(path('/feed'), { signal });
    if (
      result.session_id !== session!.id ||
      result.total_count !== session!.sheep_count ||
      result.items.length !== result.total_count
    )
      throw new ApiError('invalid-response');
    items = [...result.items].sort((a, b) => a.position - b.position);
    feed = items.map((item, i) => {
      if (item.position !== i + 1) throw new ApiError('invalid-response');
      if (item.type === 'card' && item.card) return item.card;
      if (item.type !== 'pause' || !item.pause)
        throw new ApiError('invalid-response');
      return {
        id: item.id,
        available: false,
        kind: 'text',
        tone: null,
        category_id: null,
        author_type: 'editorial',
        author_label: null,
        content: null,
        viewer: { yarn_sent: false, fluff_saved: false, song_saved: false },
      } satisfies Card;
    });
    return feed;
  };
  const accept = (value: Session) => {
    if (
      !value?.id ||
      value.night_id !== nightId ||
      !Number.isInteger(value.writer_epoch) ||
      value.writer_epoch < 1 ||
      !Number.isInteger(value.sheep_count) ||
      value.sheep_count < 3 ||
      value.sheep_count > 30
    )
      throw new ApiError('invalid-response');
    session = value;
  };
  const entry: NightEntryActions = {
    async checkWorry(value, signal) {
      const result = await api.request<NightWorryResult>(
        '/nights/current/worry',
        { method: 'PUT', body: { ...value }, signal },
      );
      nightId = result.id;
      draft = { ...value };
      return result;
    },
    async continueSupport(id, signal) {
      const value = await api.request<NightWorryResult>(
        `/nights/${segment(id)}/support/continue`,
        { method: 'POST', signal },
      );
      nightId = value.id;
      return { id: value.id, active_session_id: null };
    },
    async startCounting(count, signal) {
      if (!nightId) throw new ApiError('invalid-response');
      createWork ??= { count, key: operationKey() };
      try {
        accept(
          await api.request<Session>(`/nights/${segment(nightId)}/sessions`, {
            method: 'POST',
            body: { sheep_count: createWork.count },
            idempotencyKey: createWork.key,
            signal,
          }),
        );
      } catch (error) {
        if (error instanceof ApiError && [400, 422].includes(error.status ?? 0))
          createWork = null;
        // An uncertain create is recovered by bootstrap/resume before another create.
        if (
          error instanceof ApiError &&
          (error.kind === 'network' ||
            error.kind === 'timeout' ||
            error.code === 'ACTIVE_SESSION_EXISTS')
        ) {
          const b = await resources.bootstrap(signal);
          if (b.active_session_id && b.night_id === nightId) {
            accept(
              await api.request<Session>(
                `/sessions/${segment(b.active_session_id)}/resume`,
                { method: 'POST', idempotencyKey: resumeKey, signal },
              ),
            );
          } else throw error;
        } else throw error;
      }
      await loadFeed(signal);
    },
  };
  async function progress(value: FeedPosition, signal: AbortSignal) {
    return serial(async () => {
      if (!session) throw new ApiError('invalid-response');
      if (pending) {
        await api.request(path('/progress'), {
          method: 'PUT',
          body: { ...pending },
          signal,
        });
        session.sequence = pending.sequence;
        pending = null;
      }
      pending = {
        position: value.position,
        furthest_position: value.furthestPosition,
        writer_epoch: session.writer_epoch,
        sequence: session.sequence + 1,
      };
      const result = await api.request<Progress>(path('/progress'), {
        method: 'PUT',
        body: { ...pending },
        signal,
      });
      session = { ...session, ...result };
      pending = null;
    });
  }
  const closing: ClosingActions = {
    finish(input, key, signal) {
      return serial(async () => {
        if (!session) throw new ApiError('invalid-response');
        if (pending) {
          await api.request(path('/progress'), {
            method: 'PUT',
            body: { ...pending },
            signal,
          });
          session.sequence = pending.sequence;
          pending = null;
        }
        if (!finishes.has(key))
          finishes.set(key, {
            reason: input.reason,
            position: input.position,
            furthest_position: input.furthestPosition,
            sequence: session.sequence + 1,
            writer_epoch: session.writer_epoch,
          });
        return api.request<ClosingResult>(path('/finish'), {
          method: 'POST',
          body: { ...finishes.get(key)! },
          idempotencyKey: key,
          signal,
        });
      });
    },
    markViewed: (_id, _key, signal) =>
      api.request<void>(path('/closing-view'), {
        method: 'PUT',
        body: { viewed: true },
        signal,
      }),
    chooseWriting: (choice, _key, signal) =>
      api
        .request<void>(`/nights/${segment(nightId!)}/writing-offer`, {
          method: 'PUT',
          body: { choice },
          signal,
        })
        .then(() => undefined),
  };
  const reactions = {
    yarn: {
      set: (id: string, sent: boolean, signal: AbortSignal) =>
        api.request<{ card_id: string; sent: boolean }>(
          `/cards/${segment(id)}/yarn`,
          { method: 'PUT', body: { sent }, signal },
        ),
    },
    fluff: {
      set: (id: string, saved: boolean, signal: AbortSignal) =>
        api.request<{ card_id: string; saved: boolean }>(
          `/nights/${segment(nightId!)}/fluff/${segment(id)}`,
          { method: 'PUT', body: { saved }, signal },
        ),
    },
    songs: {
      load: async (signal: AbortSignal) =>
        (
          await api.request<{
            saved_songs: import('../features/songs/types').SavedSong[];
          }>(`/morning?night_id=${segment(nightId!)}`, { signal })
        ).saved_songs,
      set: async (id: string, saved: boolean, signal: AbortSignal) =>
        (
          await api.request<{ saved: boolean }>(
            `/nights/${segment(nightId!)}/songs/${segment(id)}`,
            { method: 'PUT', body: { saved }, signal },
          )
        ).saved,
    },
  };
  return {
    entry,
    closing,
    ...reactions,
    progress,
    nightId: () => nightId,
    initialPosition: () => ({
      position: session?.position ?? 1,
      furthestPosition: session?.furthest_position ?? 1,
    }),
    loadFeed,
    async resume(signal: AbortSignal) {
      if (!boot.active_session_id) throw new ApiError('invalid-response');
      accept(
        await api.request<Session>(
          `/sessions/${segment(boot.active_session_id)}/resume`,
          { method: 'POST', idempotencyKey: resumeKey, signal },
        ),
      );
      await loadFeed(signal);
    },
    entrust(): EntrustActions | undefined {
      const item = items.find((i) => i.pause?.kind === 'entrust_worry');
      if (!item) return;
      return {
        item: {
          id: item.id,
          position: item.position,
          worry_text: draft?.worry_text ?? '',
        },
        load: async (signal) => {
          await loadFeed(signal);
          return {
            item_id: item.id,
            action: items.find((i) => i.id === item.id)?.pause?.action ?? null,
          };
        },
        save: async (action, signal) => {
          const r = await api.request<{
            item_id: string;
            action: EntrustAction;
          }>(path(`/pauses/${segment(item.id)}`), {
            method: 'PUT',
            body: { action },
            signal,
          });
          item.pause!.action = r.action;
          return r;
        },
      };
    },
    stopOffer(): StopOfferItem | undefined {
      const item = items.find((i) => i.pause?.kind === 'stop_offer');
      if (item && item.position === 14) return { id: item.id, position: 14 };
    },
    expiry: {
      load: async (signal: AbortSignal) => {
        const b = await resources.bootstrap(signal);
        return {
          server_time: b.server_time,
          closes_at: session?.closes_at
            ? new Date(session.closes_at).toISOString()
            : new Date(
                Date.parse(`${b.night_date}T04:00:00+09:00`) + 86400000,
              ).toISOString(),
          closed: b.phase === 'day' || b.night_id !== nightId,
        };
      },
    },
  };
}
export type LiveNight = ReturnType<typeof createLiveNight>;

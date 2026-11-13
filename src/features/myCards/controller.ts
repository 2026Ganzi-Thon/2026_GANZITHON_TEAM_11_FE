import { ApiError } from '../../api/errors';
import type { MyCardsActions, MyCardsFilter, Submission } from './types';

interface Snapshot {
  filter: MyCardsFilter | null;
  items: Submission[];
  nextCursor: string | null;
  loaded: boolean;
  loading: boolean;
  error: 'initial' | 'more' | 'refresh' | null;
}
/** Owns filtered pages and confirmed deletions for one data source. */
export function createMyCardsController(actions: MyCardsActions) {
  let active = false;
  let request: AbortController | null = null;
  let data: Snapshot = {
    filter: null,
    items: [],
    nextCursor: null,
    loaded: false,
    loading: true,
    error: null,
  };
  const cursors = new Set<string | null>();
  const deleted = new Set<string>();
  const listeners = new Set<() => void>();
  const publish = (next: Snapshot) => {
    data = next;
    listeners.forEach((listener) => listener());
  };
  async function load(cursor: string | null) {
    if (!active || request || data.filter === null) return;
    const filter = data.filter;
    const pending = new AbortController();
    request = pending;
    publish({ ...data, loading: true, error: null });
    try {
      const page = await actions.load(
        {
          ...(filter === 'all' ? {} : { status: filter }),
          ...(cursor === null ? {} : { cursor }),
        },
        pending.signal,
      );
      if (!active || pending.signal.aborted || request !== pending) return;
      if (
        page.next_cursor !== null &&
        (!page.next_cursor ||
          page.next_cursor === cursor ||
          cursors.has(page.next_cursor))
      )
        throw new ApiError('invalid-response');
      const items = [
        ...new Map(
          [...(cursor === null ? [] : data.items), ...page.items].map(
            (item) => [item.id, item],
          ),
        ).values(),
      ].filter((item) => !deleted.has(item.id));
      cursors.add(cursor);
      publish({
        filter,
        items,
        nextCursor: page.next_cursor,
        loaded: true,
        loading: false,
        error: null,
      });
    } catch {
      if (active && !pending.signal.aborted && request === pending)
        publish({
          ...data,
          loading: false,
          error: cursor !== null ? 'more' : data.loaded ? 'refresh' : 'initial',
        });
    } finally {
      if (request === pending) request = null;
    }
  }
  return {
    getSnapshot: () => data,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start() {
      active = true;
      if (data.filter !== null && data.loading) void load(null);
    },
    selectFilter(filter: MyCardsFilter) {
      if (!active || data.filter === filter) return;
      request?.abort();
      request = null;
      cursors.clear();
      publish({
        filter,
        items: [],
        nextCursor: null,
        loaded: false,
        loading: true,
        error: null,
      });
      void load(null);
    },
    confirmDeleted(id: string) {
      if (!active) return;
      deleted.add(id);
      request?.abort();
      request = null;
      cursors.clear();
      publish({
        ...data,
        items: data.items.filter((item) => item.id !== id),
        nextCursor: null,
        loading: true,
        error: null,
      });
      void load(null);
    },
    refresh(id: string) {
      if (!active) return;
      request?.abort();
      request = null;
      cursors.clear();
      publish({
        ...data,
        items: data.items.filter((item) => item.id !== id),
        nextCursor: null,
        loading: true,
        error: null,
      });
      void load(null);
    },
    stop() {
      active = false;
      request?.abort();
      request = null;
    },
    loadMore() {
      if (data.loaded && data.nextCursor !== null && !data.error)
        void load(data.nextCursor);
    },
    retry() {
      if (data.error) void load(data.error === 'more' ? data.nextCursor : null);
    },
  };
}

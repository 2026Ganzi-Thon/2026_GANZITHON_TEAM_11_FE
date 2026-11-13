import { ApiError } from '../../api/errors';
import type { MyCardsActions, MyCardsFilter, Submission } from './types';

interface Snapshot {
  items: Submission[];
  nextCursor: string | null;
  loaded: boolean;
  loading: boolean;
  error: 'initial' | 'more' | null;
}
/** Owns a single filtered, paginated list independently of React renders. */
export function createMyCardsController(
  actions: MyCardsActions,
  filter: MyCardsFilter,
) {
  let active = false;
  let request: AbortController | null = null;
  let data: Snapshot = {
    items: [],
    nextCursor: null,
    loaded: false,
    loading: true,
    error: null,
  };
  const cursors = new Set<string | null>();
  const listeners = new Set<() => void>();
  const publish = (next: Snapshot) => {
    data = next;
    listeners.forEach((listener) => listener());
  };
  async function load(cursor: string | null) {
    if (!active || request) return;
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
      ];
      cursors.add(cursor);
      publish({
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
          error: cursor === null ? 'initial' : 'more',
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

import { ApiError } from '../../api/errors';
import { categories } from '../night/categories';
import { reflectionLabels } from '../morning/reflection';
import type { WorryListActions, WorryPage, WorryRecord } from './types';
interface Snapshot {
  items: WorryRecord[];
  nextCursor: string | null;
  loaded: boolean;
  loading: boolean;
  error: 'initial' | 'more' | null;
}
function validate(page: WorryPage) {
  if (
    !page ||
    !Array.isArray(page.items) ||
    (page.next_cursor !== null &&
      (typeof page.next_cursor !== 'string' || !page.next_cursor.trim()))
  )
    throw new ApiError('invalid-response');
  for (const item of page.items) {
    if (
      !item ||
      typeof item.night_id !== 'string' ||
      !item.night_id.trim() ||
      !/^\d{4}-\d{2}-\d{2}$/.test(item.night_date) ||
      typeof item.worry_text !== 'string' ||
      !item.worry_text.trim() ||
      !categories.some((c) => c.id !== 'none' && c.id === item.category_id) ||
      (item.reflection !== null &&
        (!item.reflection ||
          !Object.hasOwn(reflectionLabels, item.reflection.answer) ||
          typeof item.reflection.message !== 'string'))
    )
      throw new ApiError('invalid-response');
  }
}
/** One source owns the read-only pages. A later deletion source can invalidate these reads. */
export function createWorryListController(actions: WorryListActions) {
  let active = false,
    request: AbortController | null = null;
  let data: Snapshot = {
    items: [],
    nextCursor: null,
    loaded: false,
    loading: true,
    error: null,
  };
  const visited = new Set<string | null>();
  const listeners = new Set<() => void>();
  const publish = (next: Snapshot) => {
    data = next;
    listeners.forEach((fn) => fn());
  };
  async function load(cursor: string | null) {
    if (!active || request) return;
    const controller = new AbortController();
    request = controller;
    publish({ ...data, loading: true, error: null });
    try {
      const page = await actions.load(
        cursor === null ? {} : { cursor },
        controller.signal,
      );
      if (!active || controller.signal.aborted || request !== controller)
        return;
      validate(page);
      if (
        page.next_cursor !== null &&
        (page.next_cursor === cursor || visited.has(page.next_cursor))
      )
        throw new ApiError('invalid-response');
      const merged = new Map(
        [...(cursor === null ? [] : data.items), ...page.items].map((item) => [
          item.night_id,
          item,
        ]),
      );
      visited.add(cursor);
      publish({
        items: [...merged.values()],
        nextCursor: page.next_cursor,
        loaded: true,
        loading: false,
        error: null,
      });
    } catch {
      if (active && !controller.signal.aborted && request === controller)
        publish({
          ...data,
          loading: false,
          error: cursor === null ? 'initial' : 'more',
        });
    } finally {
      if (request === controller) request = null;
    }
  }
  return {
    getSnapshot: () => data,
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
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
      if (data.loaded && data.nextCursor !== null) void load(data.nextCursor);
    },
    retry() {
      if (data.error) void load(data.error === 'more' ? data.nextCursor : null);
    },
  };
}

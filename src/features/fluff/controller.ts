import type { Card } from '../../api/contracts';
import { ApiError } from '../../api/errors';
import type { FluffActions, FluffController, FluffState } from './types';
interface Entry extends FluffState {
  request: AbortController | null;
  timer?: ReturnType<typeof setTimeout>;
}
const initial = (card: Card): FluffState => ({
  saved: card.viewer.fluff_saved,
  target: card.viewer.fluff_saved,
  pending: false,
  error: null,
  notice: null,
});
/** Owns one feed's night-scoped bookmarks, independently of mounted cards. */
export function createFluffController(actions?: FluffActions): FluffController {
  const entries = new Map<string, Entry>(),
    listeners = new Set<() => void>();
  let active = true,
    closed = false,
    version = 0;
  const publish = () => {
    version++;
    listeners.forEach((listener) => listener());
  };
  function clearNotice(entry: Entry) {
    clearTimeout(entry.timer);
    entry.timer = undefined;
    entry.notice = null;
  }
  function cancel(entry: Entry) {
    entry.request?.abort();
    entry.request = null;
    entry.pending = false;
    entry.target = entry.saved;
    clearNotice(entry);
  }
  function ensure(card: Card) {
    let entry = entries.get(card.id);
    if (!entry) {
      entry = { ...initial(card), request: null };
      entries.set(card.id, entry);
    }
    return entry;
  }
  async function pump(id: string, entry: Entry) {
    if (!active || closed || !actions || entry.request) return;
    while (active && !closed) {
      const target = entry.target,
        request = new AbortController();
      entry.request = request;
      entry.pending = true;
      entry.error = null;
      publish();
      try {
        const result = await actions.set(id, target, request.signal);
        if (!active || request.signal.aborted || entry.request !== request)
          return;
        if (result?.card_id !== id || result.saved !== target)
          throw new ApiError('invalid-response');
        entry.saved = result.saved;
        entry.request = null;
        if (entry.target !== entry.saved) {
          publish();
          continue;
        }
        entry.pending = false;
        entry.notice = entry.saved ? 'saved' : 'removed';
        const timer = setTimeout(() => {
          if (!active || entry.timer !== timer) return;
          entry.timer = undefined;
          entry.notice = null;
          publish();
        }, 5000);
        entry.timer = timer;
        publish();
        return;
      } catch (error) {
        if (!active || request.signal.aborted || entry.request !== request)
          return;
        entry.request = null;
        entry.pending = false;
        if (error instanceof ApiError && error.code === 'NIGHT_CLOSED') {
          closed = true;
          entries.forEach((item) => {
            cancel(item);
            if (item.error !== 'unavailable') item.error = 'closed';
          });
        } else {
          entry.error =
            error instanceof ApiError &&
            (error.code === 'CARD_UNAVAILABLE' ||
              [404, 410].includes(error.status ?? 0))
              ? 'unavailable'
              : 'failed';
        }
        publish();
        return;
      }
    }
  }
  const allowed = (card: Card) =>
    active && !closed && !!actions && card.available && !!card.content;
  return {
    stateFor(card) {
      const e = entries.get(card.id),
        state = e
          ? {
              saved: e.saved,
              target: e.target,
              pending: e.pending,
              error: e.error,
              notice: e.notice,
            }
          : initial(card);
      return closed && state.error !== 'unavailable'
        ? { ...state, error: 'closed' }
        : state;
    },
    toggle(card) {
      if (!allowed(card)) return;
      const e = ensure(card);
      if (e.error === 'unavailable') return;
      clearNotice(e);
      e.target = e.error ? !e.saved : !e.target;
      e.error = null;
      publish();
      void pump(card.id, e);
    },
    retry(card) {
      if (!allowed(card)) return;
      const e = ensure(card);
      if (e.error !== 'failed' || e.request) return;
      clearNotice(e);
      e.error = null;
      void pump(card.id, e);
    },
    start() {
      active = true;
    },
    stop() {
      active = false;
      entries.forEach(cancel);
      publish();
    },
    hasPending: () => [...entries.values()].some((entry) => entry.pending),
    isClosed: () => closed,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getVersion: () => version,
  };
}

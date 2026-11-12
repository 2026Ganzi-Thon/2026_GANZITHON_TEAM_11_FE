import type { Card } from '../../api/contracts';
import { ApiError } from '../../api/errors';
import type { YarnActions, YarnController, YarnState } from './types';
interface Entry extends YarnState {
  request: AbortController | null;
  timer?: ReturnType<typeof setTimeout>;
}
const initial = (card: Card): YarnState => ({
  sent: card.viewer.yarn_sent,
  target: card.viewer.yarn_sent,
  pending: false,
  error: null,
  notice: null,
});
/** Owns a feed's requests, independently of its keyed card components. */
export function createYarnController(actions?: YarnActions): YarnController {
  const entries = new Map<string, Entry>();
  const listeners = new Set<() => void>();
  let version = 0;
  let active = true;
  function publish() {
    version++;
    listeners.forEach((listener) => listener());
  }
  function clearNotice(entry: Entry) {
    clearTimeout(entry.timer);
    entry.timer = undefined;
    entry.notice = null;
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
    if (!active || !actions || entry.request) return;
    while (active) {
      const target = entry.target;
      const request = new AbortController();
      entry.request = request;
      entry.pending = true;
      entry.error = null;
      publish();
      try {
        const result = await actions.set(id, target, request.signal);
        if (!active || request.signal.aborted || entry.request !== request)
          return;
        if (result?.card_id !== id || result.sent !== target)
          throw new ApiError('invalid-response');
        entry.sent = result.sent;
        entry.request = null;
        // The next request is only issued after this target is confirmed.
        if (entry.target !== entry.sent) {
          publish();
          continue;
        }
        entry.pending = false;
        entry.notice = entry.sent ? 'sent' : 'removed';
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
        entry.error =
          error instanceof ApiError &&
          (error.code === 'CARD_UNAVAILABLE' ||
            [404, 410].includes(error.status ?? 0))
            ? 'unavailable'
            : 'failed';
        // Preserve final intent: a lost response may already have changed the server.
        publish();
        return;
      }
    }
  }
  const allowed = (card: Card) =>
    active && !!actions && card.available && !!card.content;
  return {
    stateFor(card) {
      const entry = entries.get(card.id);
      return entry
        ? {
            sent: entry.sent,
            target: entry.target,
            pending: entry.pending,
            error: entry.error,
            notice: entry.notice,
          }
        : initial(card);
    },
    toggle(card) {
      if (!allowed(card)) return;
      const entry = ensure(card);
      if (entry.error === 'unavailable') return;
      clearNotice(entry);
      entry.target = entry.error ? !entry.sent : !entry.target;
      entry.error = null;
      publish();
      void pump(card.id, entry);
    },
    retry(card) {
      if (!allowed(card)) return;
      const entry = ensure(card);
      if (entry.error !== 'failed' || entry.request) return;
      clearNotice(entry);
      entry.error = null;
      // Always PUT the final target, even if it equals the last known value.
      void pump(card.id, entry);
    },
    start() {
      active = true;
    },
    stop() {
      active = false;
      entries.forEach((entry) => {
        entry.request?.abort();
        entry.request = null;
        entry.pending = false;
        entry.target = entry.sent;
        clearNotice(entry);
      });
      publish();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getVersion: () => version,
  };
}

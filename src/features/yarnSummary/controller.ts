import { ApiError } from '../../api/errors';
import type { ReceivedYarnActions, ReceivedYarnSummary } from './types';
interface Snapshot {
  phase: 'loading' | 'ready' | 'none' | 'error';
  summary: ReceivedYarnSummary | null;
  visible: boolean;
  displayed: boolean;
  seen: 'idle' | 'pending' | 'saved' | 'error';
}
function valid(value: unknown): value is ReceivedYarnSummary {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  if (
    typeof item.id !== 'string' ||
    !item.id.trim() ||
    typeof item.date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(item.date)
  )
    return false;
  const date = new Date(`${item.date}T00:00:00Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== item.date
  )
    return false;
  return (
    typeof item.yarn_count === 'number' &&
    typeof item.sender_count === 'number' &&
    Number.isSafeInteger(item.yarn_count) &&
    Number.isSafeInteger(item.sender_count) &&
    item.yarn_count >= 0 &&
    item.sender_count >= 0 &&
    item.sender_count <= item.yarn_count &&
    (item.yarn_count === 0 ? item.sender_count === 0 : item.sender_count > 0)
  );
}
/** One source owns its requests; only a real modal presentation may acknowledge. */
export function createReceivedYarnController(actions: ReceivedYarnActions) {
  let active = false,
    blocked = false;
  let request: AbortController | null = null;
  let data: Snapshot = {
    phase: 'loading',
    summary: null,
    visible: false,
    displayed: false,
    seen: 'idle',
  };
  const listeners = new Set<() => void>();
  const publish = (next: Snapshot) => {
    data = next;
    listeners.forEach((listener) => listener());
  };
  async function load() {
    if (!active || request) return;
    const controller = new AbortController();
    request = controller;
    publish({
      phase: 'loading',
      summary: null,
      visible: false,
      displayed: false,
      seen: 'idle',
    });
    try {
      const summary = await actions.load(controller.signal);
      if (!active || request !== controller || controller.signal.aborted)
        return;
      if (summary !== null && !valid(summary))
        throw new ApiError('invalid-response');
      const available = summary !== null && summary.yarn_count > 0;
      publish({
        ...data,
        phase: available ? 'ready' : 'none',
        summary: available ? { ...summary } : null,
        visible: available,
      });
    } catch {
      if (active && request === controller && !controller.signal.aborted)
        publish({ ...data, phase: 'error', visible: false });
    } finally {
      if (request === controller) request = null;
    }
  }
  async function markSeen() {
    if (
      !active ||
      request ||
      !data.displayed ||
      !data.summary ||
      data.seen === 'saved'
    )
      return;
    const controller = new AbortController();
    request = controller;
    const id = data.summary.id;
    publish({ ...data, seen: 'pending' });
    try {
      await actions.markSeen(id, controller.signal);
      if (active && request === controller && !controller.signal.aborted)
        publish({ ...data, seen: 'saved' });
    } catch {
      if (active && request === controller && !controller.signal.aborted)
        publish({ ...data, seen: 'error' });
    } finally {
      if (request === controller) request = null;
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
    block(value: boolean) {
      blocked = value;
    },
    start() {
      active = true;
      if (data.phase === 'loading') void load();
    },
    stop() {
      active = false;
      request?.abort();
      request = null;
      if (data.seen === 'pending') data = { ...data, seen: 'error' };
    },
    retryLoad() {
      if (data.phase === 'error') void load();
    },
    shown() {
      if (
        !active ||
        blocked ||
        !data.visible ||
        !data.summary ||
        data.displayed ||
        request
      )
        return;
      publish({ ...data, displayed: true });
      void markSeen();
    },
    retrySeen() {
      if (data.seen === 'error') void markSeen();
    },
    dismiss() {
      if (active) publish({ ...data, visible: false });
    },
  };
}

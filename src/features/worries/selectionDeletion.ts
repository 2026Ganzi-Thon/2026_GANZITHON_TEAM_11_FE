import { ApiError } from '../../api/errors';
import type { RecordDeletionPort } from './recordDeletion';
export type SelectionStatus = 'pending' | 'done' | 'failed' | 'unknown';
export interface SelectionSnapshot {
  items: { nightId: string; status: SelectionStatus }[];
  pending: boolean;
}
export function createWorrySelectionController(port: RecordDeletionPort) {
  let data: SelectionSnapshot = { items: [], pending: false },
    request: AbortController | null = null;
  const listeners = new Set<() => void>();
  const publish = (next: SelectionSnapshot) => {
    data = next;
    listeners.forEach((listener) => listener());
  };
  const status = (id: string, value: SelectionStatus) =>
    publish({
      ...data,
      items: data.items.map((item) =>
        item.nightId === id ? { ...item, status: value } : item,
      ),
    });
  const pause = () => {
    if (!request) return;
    const old = request;
    request = null;
    publish({
      pending: false,
      items: data.items.map((item) =>
        item.status === 'pending' ? { ...item, status: 'unknown' } : item,
      ),
    });
    old.abort();
  };
  async function run() {
    if (request) return;
    const controller = new AbortController();
    request = controller;
    const current = () => request === controller && !controller.signal.aborted;
    const targets = data.items.map((item) => ({ ...item }));
    publish({ ...data, pending: true });
    for (const item of targets) {
      if (!current()) break;
      if (item.status === 'done') continue;
      status(item.nightId, 'pending');
      let next: SelectionStatus = 'unknown';
      try {
        if (port.isDeleted(item.nightId)) next = 'done';
        else if (item.status === 'unknown')
          next = (await port.check(item.nightId, controller.signal))
            ? 'done'
            : 'failed';
        else {
          try {
            await port.remove(item.nightId, controller.signal);
            next = 'done';
          } catch {
            if (!current()) break;
            next = (await port.check(item.nightId, controller.signal))
              ? 'done'
              : 'failed';
          }
        }
      } catch {
        next = 'unknown';
      }
      if (current()) status(item.nightId, next);
    }
    if (current()) {
      request = null;
      publish({ ...data, pending: false });
    }
  }
  return {
    getSnapshot: () => data,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (!listeners.size) pause();
      };
    },
    async start(ids: string[]) {
      if (request || data.items.some((item) => item.status !== 'done')) return;
      if (!ids.length || ids.some((id) => !id.trim()))
        throw new ApiError('configuration');
      publish({
        items: [...new Set(ids)].map((nightId) => ({
          nightId,
          status: 'failed',
        })),
        pending: false,
      });
      await run();
    },
    retry: run,
    pause,
    reset() {
      if (!request && !data.items.some((item) => item.status === 'unknown'))
        publish({ items: [], pending: false });
    },
  };
}

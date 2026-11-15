import { ApiError } from '../api/errors';
import { reminderTime } from './model';
import type { createDeviceReminder } from './service';
import type {
  DevicePermission,
  DeviceReminderState,
  ReminderSetting,
} from './types';
export interface DeviceSnapshot {
  phase: 'checking' | 'ready' | 'error';
  state?: DeviceReminderState;
  permission: DevicePermission | null;
}
export interface ReminderDeviceConnection {
  getSnapshot(): DeviceSnapshot;
  subscribe(listener: () => void): () => void;
  refresh(): Promise<void>;
  requestPermission(): Promise<void>;
  openSettings(): Promise<void>;
}
export function createReminderConnection(
  backend: {
    load(signal: AbortSignal): Promise<ReminderSetting>;
    save(
      target: ReminderSetting,
      signal: AbortSignal,
    ): Promise<ReminderSetting>;
  },
  service: ReturnType<typeof createDeviceReminder>,
) {
  let snapshot: DeviceSnapshot = { phase: 'checking', permission: null };
  let queue: Promise<unknown> = Promise.resolve();
  const listeners = new Set<() => void>();
  const publish = (next: DeviceSnapshot) => {
    snapshot = next;
    listeners.forEach((listener) => listener());
  };
  function serial<T>(job: () => Promise<T>): Promise<T> {
    const next = queue.then(job);
    queue = next.catch(() => undefined);
    return next;
  }
  async function reconcile() {
    publish({ phase: 'checking', permission: null });
    try {
      const saved = await backend.load(new AbortController().signal);
      reminderTime(saved);
      const state = await service.sync(saved);
      const permission =
        state.state === 'permission-required'
          ? state.permission
          : await service.readPermission().catch(() => null);
      publish({ phase: 'ready', state, permission });
    } catch {
      publish({ phase: 'error', permission: null });
    }
  }
  const device: ReminderDeviceConnection = {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    refresh: () => serial(reconcile),
    requestPermission: () =>
      serial(async () => {
        publish({ phase: 'checking', permission: null });
        try {
          await service.requestPermission();
          await reconcile();
        } catch {
          publish({ phase: 'error', permission: null });
        }
      }),
    openSettings: () =>
      serial(async () => {
        try {
          await service.openSettings();
        } catch {
          publish({ phase: 'error', permission: null });
        }
      }),
  };
  return {
    device,
    load: (signal: AbortSignal) => backend.load(signal),
    save: (
      target: ReminderSetting,
      signal: AbortSignal,
    ): Promise<ReminderSetting> => {
      const captured = { ...target };
      return serial(async () => {
        if (signal.aborted) throw new ApiError('aborted');
        publish({ phase: 'checking', permission: null });
        let result: ReminderSetting;
        try {
          result = await backend.save(captured, signal);
          try {
            reminderTime(result);
          } catch {
            throw new ApiError('invalid-response');
          }
          if (
            result.enabled !== captured.enabled ||
            result.local_time !== captured.local_time
          )
            throw new ApiError('invalid-response');
        } catch (error) {
          // The write may have committed before its response was lost or cancelled.
          await reconcile();
          throw error;
        }
        // A native failure does not turn a committed account write into a failed one.
        await reconcile();
        return result;
      });
    },
    readPermission: async () => {
      const value = await service.readPermission();
      return value.channel === 'blocked' ? ('denied' as const) : value.status;
    },
  };
}

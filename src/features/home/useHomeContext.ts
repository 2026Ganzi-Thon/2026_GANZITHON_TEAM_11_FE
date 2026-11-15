import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  readHomeSnapshot,
  untilHomeBoundary,
  type HomeClockActions,
  type HomeSnapshot,
} from './model';
export function useHomeContext(
  actions: HomeClockActions,
  onNight: (snapshot: HomeSnapshot) => void,
) {
  const [state, setState] = useState<{
    snapshot: HomeSnapshot | null;
    pending: boolean;
    error: boolean;
  }>({ snapshot: null, pending: true, error: false });
  const active = useRef<AbortController | null>(null),
    receivedAt = useRef(0),
    foreground = useRef(
      AppState.currentState !== 'background' &&
        AppState.currentState !== 'inactive',
    );
  const openNight = useRef(onNight);
  useEffect(() => {
    openNight.current = onNight;
  }, [onNight]);
  const run = useCallback(
    async (open = false) => {
      if (!foreground.current) return;
      if (active.current) {
        if (open) return;
        active.current.abort();
        active.current = null;
      }
      const controller = new AbortController();
      active.current = controller;
      const current = () =>
        active.current === controller &&
        !controller.signal.aborted &&
        foreground.current;
      setState((previous) => ({ ...previous, pending: true, error: false }));
      try {
        const result = await actions.load(controller.signal);
        if (!current()) return;
        const snapshot = readHomeSnapshot(result);
        receivedAt.current = performance.now();
        setState({ snapshot, pending: false, error: false });
        if (open && snapshot.phase === 'night') openNight.current(snapshot);
      } catch {
        if (current())
          setState((previous) => ({
            ...previous,
            pending: false,
            error: true,
          }));
      } finally {
        if (active.current === controller) active.current = null;
      }
    },
    [actions],
  );
  const refresh = useCallback(() => {
    void run();
  }, [run]);
  useEffect(() => {
    let mounted = true;
    void Promise.resolve().then(() => {
      if (mounted) refresh();
    });
    const listener = AppState.addEventListener('change', (status) => {
      foreground.current = status === 'active';
      if (foreground.current) refresh();
      else {
        active.current?.abort();
        active.current = null;
        setState((previous) => ({ ...previous, pending: true }));
      }
    });
    return () => {
      mounted = false;
      listener.remove();
      active.current?.abort();
      active.current = null;
    };
  }, [refresh]);
  useEffect(() => {
    if (!state.snapshot || state.pending || state.error || !foreground.current)
      return;
    const remaining =
      untilHomeBoundary(Date.parse(state.snapshot.server_time)) -
      (performance.now() - receivedAt.current);
    const timer = setTimeout(refresh, Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, [state.snapshot, state.pending, state.error, refresh]);
  const open = () => {
    if (!state.pending && !state.error && state.snapshot?.phase === 'night')
      void run(true);
  };
  return { ...state, refresh, open };
}
export type HomeContext = ReturnType<typeof useHomeContext>;

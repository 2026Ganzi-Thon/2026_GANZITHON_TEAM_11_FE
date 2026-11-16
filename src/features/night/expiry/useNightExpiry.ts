import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { ApiError } from '../../../api/errors';
import type { NightExpiryActions, NightExpirySnapshot } from './types';
type Phase = 'checking' | 'open' | 'expired' | 'error';
function read(value: NightExpirySnapshot) {
  const server = Date.parse(value?.server_time),
    end = Date.parse(value?.closes_at);
  if (
    typeof value?.server_time !== 'string' ||
    !value.server_time.includes('T') ||
    typeof value?.closes_at !== 'string' ||
    !value.closes_at.includes('T') ||
    !Number.isFinite(server) ||
    !Number.isFinite(end) ||
    typeof value?.closed !== 'boolean' ||
    value.closed !== server >= end
  )
    throw new ApiError('invalid-response');
  return { snapshot: value, remaining: end - server };
}
export function useNightExpiry(actions: NightExpiryActions) {
  const [state, setState] = useState<{
    phase: Phase;
    opened: boolean;
    foreground: boolean;
  }>({
    phase: 'checking',
    opened: false,
    foreground:
      AppState.currentState !== 'background' &&
      AppState.currentState !== 'inactive',
  });
  const retry = useRef<(() => void) | null>(null);
  useEffect(() => {
    let alive = true,
      version = 0,
      closed = false;
    let foreground =
      AppState.currentState !== 'background' &&
      AppState.currentState !== 'inactive';
    let request: AbortController | null = null,
      timer: ReturnType<typeof setTimeout> | undefined;
    const clear = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    };
    const check = async () => {
      if (!alive || !foreground || closed) return;
      clear();
      request?.abort();
      const currentRequest = new AbortController(),
        token = ++version;
      request = currentRequest;
      const current = () =>
        alive &&
        foreground &&
        token === version &&
        !currentRequest.signal.aborted;
      setState((s) => ({ ...s, phase: 'checking', foreground: true }));
      try {
        const result = read(await actions.load(currentRequest.signal));
        if (!current()) return;
        closed = result.snapshot.closed;
        setState((s) => ({
          phase: closed ? 'expired' : 'open',
          opened: s.opened || !closed,
          foreground: true,
        }));
        if (!closed)
          timer = setTimeout(
            () => void check(),
            Math.min(result.remaining, 2147483647),
          );
      } catch {
        if (current()) setState((s) => ({ ...s, phase: 'error' }));
      } finally {
        if (current()) request = null;
      }
    };
    retry.current = () => void check();
    const listener = AppState.addEventListener('change', (next) => {
      const active = next === 'active';
      if (active === foreground) return;
      foreground = active;
      if (!active) {
        clear();
        request?.abort();
        request = null;
        ++version;
        if (!closed)
          setState((s) => ({ ...s, phase: 'checking', foreground: false }));
      } else if (!closed) void check();
    });
    void check();
    return () => {
      alive = false;
      ++version;
      clear();
      request?.abort();
      listener.remove();
      retry.current = null;
    };
  }, [actions]);
  return { ...state, retry: useCallback(() => retry.current?.(), []) };
}

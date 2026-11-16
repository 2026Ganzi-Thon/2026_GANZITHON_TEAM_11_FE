import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../../api/errors';
import type { EntrustAction, EntrustActions, EntrustState } from './types';
type Phase = 'loading' | 'ready' | 'saving' | 'error' | 'closed';
interface State {
  source: EntrustActions | undefined;
  phase: Phase;
  action: EntrustAction | null;
  justSaved: boolean;
}
function read(value: EntrustState, id: string, target: EntrustAction | null) {
  if (
    value?.item_id !== id ||
    (value.action !== null &&
      value.action !== 'entrusted' &&
      value.action !== 'skipped') ||
    (target !== null && value.action !== target)
  )
    throw new ApiError('invalid-response');
  return value.action;
}
export function useEntrustPause(actions?: EntrustActions, blocked = false) {
  const [state, setState] = useState<State>({
    source: actions,
    phase: actions ? 'loading' : 'ready',
    action: null,
    justSaved: false,
  });
  const commands = useRef<{
    choose: (value: EntrustAction) => Promise<void>;
    retry: () => Promise<void>;
    stop: () => void;
    isBusy: () => boolean;
  } | null>(null);
  useEffect(() => {
    if (!actions || blocked) {
      commands.current = null;
      return;
    }
    let alive = true,
      request: AbortController | null = null,
      phase: Phase = 'loading',
      action: EntrustAction | null = null,
      target: EntrustAction | null = null;
    const publish = (justSaved = false) =>
      setState({ source: actions, phase, action, justSaved });
    const execute = async (value: EntrustAction | null): Promise<void> => {
      if (!alive || request) return;
      if (value !== null) target = value;
      const current = new AbortController();
      request = current;
      const valid = () =>
        alive && request === current && !current.signal.aborted;
      phase = value === null ? 'loading' : 'saving';
      publish();
      try {
        const result =
          value === null
            ? await actions.load(current.signal)
            : await actions.save(value, current.signal);
        if (!valid()) return;
        action = read(result, actions.item.id, value);
        target = null;
        phase = 'ready';
        publish(value !== null);
      } catch (error) {
        if (!valid()) return;
        if (
          error instanceof ApiError &&
          (error.code === 'PAUSE_ALREADY_DECIDED' ||
            error.code === 'WORRY_NOT_AVAILABLE')
        ) {
          target = null;
          request = null;
          await execute(null);
          return;
        }
        phase =
          error instanceof ApiError &&
          (error.code === 'NIGHT_CLOSED' || error.code === 'SESSION_CLOSED')
            ? 'closed'
            : 'error';
        publish();
      } finally {
        if (request === current) request = null;
      }
    };
    const stop = () => {
      request?.abort();
      request = null;
    };
    commands.current = {
      choose: async (value) => {
        if (phase === 'ready' && action === null && target === null)
          await execute(value);
      },
      retry: () => execute(target),
      stop,
      isBusy: () => phase === 'loading' || phase === 'saving',
    };
    void execute(null);
    return () => {
      alive = false;
      stop();
      commands.current = null;
    };
  }, [actions, blocked]);
  const matches = state.source === actions;
  const phase = blocked
    ? 'loading'
    : matches
      ? state.phase
      : actions
        ? 'loading'
        : 'ready';
  return {
    phase,
    action: matches ? state.action : null,
    justSaved: !blocked && matches && state.justSaved,
    busy: phase === 'loading' || phase === 'saving',
    choose: useCallback(
      (value: EntrustAction) =>
        blocked ? undefined : commands.current?.choose(value),
      [blocked],
    ),
    retry: useCallback(
      () => (blocked ? undefined : commands.current?.retry()),
      [blocked],
    ),
    stop: useCallback(() => commands.current?.stop(), []),
    isBusy: useCallback(
      () => blocked || (commands.current?.isBusy() ?? false),
      [blocked],
    ),
    acknowledge: useCallback(
      () => setState((s) => ({ ...s, justSaved: false })),
      [],
    ),
  };
}

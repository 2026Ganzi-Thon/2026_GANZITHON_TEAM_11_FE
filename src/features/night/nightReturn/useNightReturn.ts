import { useCallback, useEffect, useRef, useState } from 'react';
import {
  readNightReturnRoute,
  returnRecordKey,
  type NightReturnActions,
  type NightReturnRecord,
  type ReturnRoute,
} from './model';
import type { RestartCount } from './ReturnCountPicker';
export type ReturnOutcome =
  | { kind: 'restart'; nightId: string; count: RestartCount }
  | Exclude<ReturnRoute, { kind: 'return' }>;
interface State {
  phase: 'loading' | 'ready' | 'error' | 'handoff';
  record: NightReturnRecord | null;
  outcome: ReturnOutcome | null;
}
interface Intent {
  count: RestartCount;
  recordKey: string;
}
export function useNightReturn(actions: NightReturnActions) {
  const [state, setState] = useState<State>({
    phase: 'loading',
    record: null,
    outcome: null,
  });
  const commands = useRef<{
    restart: (count: RestartCount) => void;
    retry: () => void;
    exit: () => boolean;
  } | null>(null);
  useEffect(() => {
    let alive = true,
      exited = false,
      request: AbortController | null = null,
      phase: State['phase'] = 'loading',
      record: NightReturnRecord | null = null,
      intent: Intent | null = null;
    const publish = (outcome: ReturnOutcome | null = null) =>
      setState({ phase, record, outcome });
    const execute = async () => {
      if (!alive || exited || request) return;
      const current = new AbortController();
      request = current;
      phase = 'loading';
      publish();
      const valid = () =>
        alive && !exited && request === current && !current.signal.aborted;
      try {
        const route = readNightReturnRoute(await actions.load(current.signal));
        if (!valid()) return;
        if (route.kind === 'return') {
          const restart =
            intent !== null &&
            intent.recordKey === returnRecordKey(route.record)
              ? {
                  kind: 'restart' as const,
                  nightId: route.record.nightId,
                  count: intent.count,
                }
              : null;
          record = route.record;
          intent = null;
          phase = restart ? 'handoff' : 'ready';
          publish(restart);
        } else {
          intent = null;
          phase = 'handoff';
          publish(route);
        }
      } catch {
        if (valid()) {
          phase = 'error';
          publish();
        }
      } finally {
        if (request === current) request = null;
      }
    };
    commands.current = {
      restart: (count) => {
        if (
          phase !== 'ready' ||
          !record ||
          ![3, 5, 10].includes(count) ||
          exited
        )
          return;
        intent = { count, recordKey: returnRecordKey(record) };
        void execute();
      },
      retry: () => {
        if (phase === 'error') void execute();
      },
      exit: () => {
        if (exited) return false;
        exited = true;
        request?.abort();
        request = null;
        return true;
      },
    };
    void execute();
    return () => {
      alive = false;
      request?.abort();
      request = null;
      commands.current = null;
    };
  }, [actions]);
  return {
    state,
    restart: useCallback(
      (count: RestartCount) => commands.current?.restart(count),
      [],
    ),
    retry: useCallback(() => commands.current?.retry(), []),
    exit: useCallback(() => commands.current?.exit() ?? false, []),
  };
}

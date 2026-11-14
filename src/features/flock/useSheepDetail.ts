import { useEffect, useRef, useState } from 'react';
import { maskDeletedWorry, type WorryDeletions } from '../worries/deletions';
import { ApiError } from '../../api/errors';
import type { SheepDetail, SheepDetailLoad } from './types';

type Result =
  | { phase: 'loading' | 'error' | 'unavailable' }
  | { phase: 'ready'; detail: SheepDetail };
export function useSheepDetail(
  sheepId: string,
  load: SheepDetailLoad,
  onBack: () => void,
  worries?: WorryDeletions,
) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    id: string;
    loader: SheepDetailLoad;
    result: Result;
  }>({ id: sheepId, loader: load, result: { phase: 'loading' } });
  const active = useRef<AbortController | null>(null);
  const closed = useRef(false);
  useEffect(() => {
    closed.current = false;
    const controller = new AbortController();
    active.current = controller;
    const publish = (result: Result) => {
      if (!controller.signal.aborted)
        setState({ id: sheepId, loader: load, result });
    };
    publish({ phase: 'loading' });
    void (async () => {
      try {
        const detail = await load(sheepId, controller.signal);
        if (controller.signal.aborted) return;
        if (detail.sheep.id !== sheepId) throw new ApiError('invalid-response');
        publish({
          phase: 'ready',
          detail: {
            ...detail,
            night: maskDeletedWorry(
              detail.night,
              detail.sheep.night_id,
              worries,
            ),
          },
        });
      } catch (error) {
        const unavailable =
          error instanceof ApiError &&
          error.kind === 'http' &&
          (error.status === 403 || error.status === 404);
        publish({ phase: unavailable ? 'unavailable' : 'error' });
      } finally {
        if (active.current === controller) active.current = null;
      }
    })();
    return () => {
      controller.abort();
      if (active.current === controller) active.current = null;
    };
  }, [sheepId, load, attempt, worries]);
  useEffect(
    () =>
      worries?.subscribe((nightId) => {
        setState((current) =>
          current.result.phase === 'ready' &&
          current.result.detail.sheep.night_id === nightId
            ? {
                ...current,
                result: {
                  phase: 'ready',
                  detail: {
                    ...current.result.detail,
                    night: maskDeletedWorry(
                      current.result.detail.night,
                      nightId,
                      worries,
                    ),
                  },
                },
              }
            : current,
        );
      }),
    [worries],
  );
  const result: Result =
    state.id === sheepId && state.loader === load
      ? state.result
      : { phase: 'loading' };
  return {
    result,
    retry: () => {
      if (!active.current && !closed.current && result.phase === 'error')
        setAttempt((value) => value + 1);
    },
    back: () => {
      if (closed.current) return;
      closed.current = true;
      active.current?.abort();
      onBack();
    },
  };
}

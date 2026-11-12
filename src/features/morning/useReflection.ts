import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../api/errors';
import type { ReflectionAnswer } from '../flock/types';
import type { ReflectionActions, ReflectionRecord } from './reflection';
export function useReflection(
  nightId: string,
  actions: ReflectionActions,
  onBack: () => void,
) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    id: string;
    api: ReflectionActions;
    phase: 'loading' | 'ready' | 'error' | 'blocked';
    record?: ReflectionRecord;
  }>({ id: nightId, api: actions, phase: 'loading' });
  const [selected, setSelected] = useState<ReflectionAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(false);
  const [saved, setSaved] = useState(false);
  const active = useRef<AbortController | null>(null);
  const closed = useRef(false);
  useEffect(() => {
    closed.current = false;
    const controller = new AbortController();
    active.current = controller;
    void Promise.resolve()
      .then(() => {
        if (controller.signal.aborted) return;
        setState({ id: nightId, api: actions, phase: 'loading' });
        setSelected(null);
        setBusy(false);
        setFailure(false);
        setSaved(false);
        return actions.load(nightId, controller.signal);
      })
      .then((record) => {
        if (controller.signal.aborted || !record) return;
        if (record.night && record.night.id !== nightId)
          throw new ApiError('invalid-response');
        setState({ id: nightId, api: actions, phase: 'ready', record });
        setSelected(record.reflection?.answer ?? null);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({
            id: nightId,
            api: actions,
            phase:
              error instanceof ApiError &&
              [403, 404, 409].includes(error.status ?? 0)
                ? 'blocked'
                : 'error',
          });
      })
      .finally(() => {
        if (active.current === controller) active.current = null;
      });
    return () => {
      closed.current = true;
      controller.abort();
      active.current?.abort();
      active.current = null;
    };
  }, [nightId, actions, attempt]);
  const current =
    state.id === nightId && state.api === actions
      ? state
      : { phase: 'loading' as const, record: undefined };
  const night = current.record?.night;
  const available =
    current.phase === 'ready' &&
    night?.category_id !== 'none' &&
    !!night?.worry_text?.trim();
  const back = () => {
    if (closed.current) return;
    closed.current = true;
    active.current?.abort();
    onBack();
  };
  const save = async () => {
    if (!available || !selected || active.current || closed.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setFailure(false);
    setSaved(false);
    try {
      const reflection = await actions.save(
        nightId,
        selected,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (reflection.answer !== selected)
        throw new ApiError('invalid-response');
      setState({
        id: nightId,
        api: actions,
        phase: 'ready',
        record: { ...current.record!, reflection },
      });
      setSaved(true);
    } catch (error) {
      if (controller.signal.aborted) return;
      if (
        error instanceof ApiError &&
        [403, 404, 409].includes(error.status ?? 0)
      )
        setState({ id: nightId, api: actions, phase: 'blocked' });
      else setFailure(true);
    } finally {
      if (active.current === controller) active.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  return {
    ...current,
    available,
    selected,
    busy,
    failure,
    saved,
    back,
    save,
    edit: () => {
      if (!active.current && !closed.current) setSaved(false);
    },
    retry: () => {
      if (!active.current && !closed.current) setAttempt((v) => v + 1);
    },
    select: (answer: ReflectionAnswer) => {
      if (!active.current && !closed.current) {
        setSelected(answer);
        setFailure(false);
        setSaved(false);
      }
    },
  };
}

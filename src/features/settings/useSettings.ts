import { ApiError } from '../../api/errors';
import { parseDate } from '../birthDate/date';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SettingsActions, SettingsData } from './types';
export function useSettings(actions: SettingsActions) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    data?: SettingsData;
    error: boolean;
    loading: boolean;
  }>({
    error: false,
    loading: true,
  });
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    void Promise.resolve()
      .then(() => {
        if (controller.signal.aborted) return;
        setState((current) => ({ ...current, error: false, loading: true }));
        return actions.loadMe(controller.signal);
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        if (
          !data?.user ||
          !data.user.id?.trim() ||
          typeof data.user.email !== 'string' ||
          !data.user.email.trim() ||
          (data.user.birth_date !== null && !parseDate(data.user.birth_date)) ||
          ![0, 1].includes(data.user.birth_date_edits_remaining) ||
          !data.user.stats ||
          ![
            data.user.stats.night_count,
            data.user.stats.counted_sheep_total,
            data.user.stats.worry_record_count,
          ].every((value) => Number.isInteger(value) && value >= 0)
        )
          throw new ApiError('invalid-response');
        setState({ data, error: false, loading: false });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setState((current) => ({ ...current, error: true, loading: false }));
      })
      .finally(() => {
        if (request.current === controller) request.current = null;
      });
    return () => {
      controller.abort();
      if (request.current === controller) request.current = null;
    };
  }, [actions, attempt]);
  useEffect(
    () =>
      actions.deletions?.subscribe(() => {
        request.current?.abort();
        request.current = null;
        setState((current) => ({ ...current, error: false, loading: true }));
        setAttempt((value) => value + 1);
      }),
    [actions],
  );
  const refresh = useCallback(() => {
    request.current?.abort();
    request.current = null;
    setState((current) => ({ ...current, error: false, loading: true }));
    setAttempt((value) => value + 1);
  }, []);
  return {
    ...state,
    retry: refresh,
    refresh,
    cancel: () => request.current?.abort(),
  };
}

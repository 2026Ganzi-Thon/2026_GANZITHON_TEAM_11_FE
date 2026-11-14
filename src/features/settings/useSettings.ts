import { ApiError } from '../../api/errors';
import { useEffect, useRef, useState } from 'react';
import type { SettingsActions, SettingsData } from './types';
export function useSettings(actions: SettingsActions) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ data?: SettingsData; error: boolean }>({
    error: false,
  });
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    void Promise.resolve()
      .then(() => {
        if (controller.signal.aborted) return;
        setState({ error: false });
        return actions.loadMe(controller.signal);
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        if (
          !data?.user ||
          !data.user.id?.trim() ||
          typeof data.user.email !== 'string' ||
          !data.user.email.trim() ||
          !data.user.stats ||
          ![
            data.user.stats.night_count,
            data.user.stats.counted_sheep_total,
            data.user.stats.worry_record_count,
          ].every((value) => Number.isInteger(value) && value >= 0)
        )
          throw new ApiError('invalid-response');
        setState({ data, error: false });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ error: true });
      })
      .finally(() => {
        if (request.current === controller) request.current = null;
      });
    return () => {
      controller.abort();
      if (request.current === controller) request.current = null;
    };
  }, [actions, attempt]);
  return {
    ...state,
    retry: () => {
      if (!request.current) setAttempt((v) => v + 1);
    },
    cancel: () => request.current?.abort(),
  };
}

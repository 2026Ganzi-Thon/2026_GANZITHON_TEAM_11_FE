import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../api/errors';
import { readFortune, type Fortune, type FortuneActions } from './types';
export function useFortune(actions: FortuneActions) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    owner: FortuneActions | null;
    attempt: number;
    fortune: Fortune | null;
    error: ApiError | null;
  }>({ owner: null, attempt: -1, fortune: null, error: null });
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    void (async () => {
      try {
        const value = await actions.load(controller.signal);
        if (controller.signal.aborted || request.current !== controller) return;
        const fortune = readFortune(value);
        setResult({ owner: actions, attempt, fortune, error: null });
      } catch (value) {
        if (!controller.signal.aborted && request.current === controller)
          setResult({
            owner: actions,
            attempt,
            fortune: null,
            error: value instanceof ApiError ? value : new ApiError('network'),
          });
      } finally {
        if (request.current === controller) request.current = null;
      }
    })();
    return () => {
      controller.abort();
      if (request.current === controller) request.current = null;
    };
  }, [actions, attempt]);
  const pending = result.owner !== actions || result.attempt !== attempt;
  return {
    fortune: pending ? null : result.fortune,
    error: pending ? null : result.error,
    pending,
    retry: () => {
      if (!request.current && !pending && result.error)
        setAttempt((value) => value + 1);
    },
  };
}

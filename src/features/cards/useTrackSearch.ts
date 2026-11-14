import { useEffect, useMemo, useState } from 'react';
import type { Track } from '../../api/contracts';
import { trimmedLength, type SongCardActions } from './songTypes';
export function useTrackSearch(
  actions: SongCardActions,
  query: string,
  enabled: boolean,
) {
  const [retry, setRetry] = useState(0);
  const key = useMemo(
    () => ({ actions, query, enabled, retry }),
    [actions, query, enabled, retry],
  );
  const [data, setData] = useState<{
    key: typeof key;
    items: Track[];
    status: 'done' | 'error';
  } | null>(null);
  useEffect(() => {
    if (!enabled || !query.trim() || trimmedLength(query) > 100) return;
    const controller = new AbortController();
    let live = true;
    const timer = setTimeout(async () => {
      try {
        const items = await actions.search(query.trim(), controller.signal);
        if (live && !controller.signal.aborted)
          setData({ key, items, status: 'done' });
      } catch {
        if (live && !controller.signal.aborted)
          setData({ key, items: [], status: 'error' });
      }
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [actions, query, enabled, key]);
  const invalid = enabled && trimmedLength(query) > 100;
  const ready = enabled && !!query.trim() && !invalid;
  return {
    items: ready && data?.key === key ? data.items : [],
    status: invalid
      ? ('invalid' as const)
      : !ready
        ? ('idle' as const)
        : data?.key === key
          ? data.status
          : ('loading' as const),
    retry: () => setRetry((n) => n + 1),
  };
}

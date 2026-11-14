import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { WorryListActions } from './types';
import { createWorryListController } from './worryListController';
export function useWorryList(actions: WorryListActions) {
  const source = useMemo(() => createWorryListController(actions), [actions]);
  const data = useSyncExternalStore(
    source.subscribe,
    source.getSnapshot,
    source.getSnapshot,
  );
  useEffect(() => {
    source.start();
    return source.stop;
  }, [source]);
  return {
    ...data,
    retry: source.retry,
    loadMore: source.loadMore,
    cancel: source.stop,
  };
}

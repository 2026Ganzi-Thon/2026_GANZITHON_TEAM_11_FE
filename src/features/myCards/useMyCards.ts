import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { createMyCardsController } from './controller';
import type { MyCardsActions, MyCardsFilter } from './types';

export function useMyCards(actions: MyCardsActions, filter: MyCardsFilter) {
  const controller = useMemo(() => createMyCardsController(actions), [actions]);
  const data = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  useEffect(() => {
    controller.start();
    return controller.stop;
  }, [controller]);
  useEffect(() => controller.selectFilter(filter), [controller, filter]);
  const current =
    data.filter === filter
      ? data
      : {
          ...data,
          items: [],
          loaded: false,
          loading: true,
          error: null,
          nextCursor: null,
        };
  return {
    ...current,
    hasMore: current.loaded && current.nextCursor !== null,
    confirmDeleted: controller.confirmDeleted,
    refresh: controller.refresh,
    loadMore: controller.loadMore,
    retry: controller.retry,
    cancel: controller.stop,
  };
}

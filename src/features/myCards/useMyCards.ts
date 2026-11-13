import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { createMyCardsController } from './controller';
import type { MyCardsActions, MyCardsFilter } from './types';

export function useMyCards(actions: MyCardsActions, filter: MyCardsFilter) {
  const controller = useMemo(
    () => createMyCardsController(actions, filter),
    [actions, filter],
  );
  const data = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  useEffect(() => {
    controller.start();
    return controller.stop;
  }, [controller]);
  return {
    ...data,
    hasMore: data.loaded && data.nextCursor !== null,
    loadMore: controller.loadMore,
    retry: controller.retry,
    cancel: controller.stop,
  };
}

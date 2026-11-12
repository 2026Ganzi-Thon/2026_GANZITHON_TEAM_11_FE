import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { createYarnController } from './controller';
import type { YarnActions } from './types';
export function useYarnReactions(
  actions: YarnActions | undefined,
  scope: unknown,
  enabled: boolean,
) {
  const { controller } = useMemo(
    () => ({ scope, controller: createYarnController(actions) }),
    [actions, scope],
  );
  useSyncExternalStore(
    controller.subscribe,
    controller.getVersion,
    controller.getVersion,
  );
  useEffect(() => {
    if (enabled) controller.start();
    else controller.stop();
    return () => controller.stop();
  }, [controller, enabled]);
  return controller;
}

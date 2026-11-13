import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { createFluffController } from './controller';
import type { FluffActions } from './types';
export function useFluffBookmarks(
  actions: FluffActions | undefined,
  scope: unknown,
  enabled: boolean,
) {
  const { controller } = useMemo(
    () => ({ scope, controller: createFluffController(actions) }),
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

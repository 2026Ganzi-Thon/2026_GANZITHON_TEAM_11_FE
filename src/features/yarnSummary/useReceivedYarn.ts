import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useSyncExternalStore,
} from 'react';
import { createReceivedYarnController } from './controller';
import type { ReceivedYarnActions } from './types';
export function useReceivedYarn(
  actions: ReceivedYarnActions,
  blocked: boolean,
) {
  const controller = useMemo(
    () => createReceivedYarnController(actions),
    [actions],
  );
  const data = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  useLayoutEffect(() => controller.block(blocked), [controller, blocked]);
  useEffect(() => {
    controller.start();
    return controller.stop;
  }, [controller]);
  return {
    ...data,
    shown: controller.shown,
    dismiss: controller.dismiss,
    retryLoad: controller.retryLoad,
    retrySeen: controller.retrySeen,
  };
}

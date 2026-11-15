import { useEffect } from 'react';
import { startNativeReminderRuntime } from './nativeRuntime';
export function AndroidReminderRuntime() {
  useEffect(() => {
    if (__DEV__) return startNativeReminderRuntime();
  }, []);
  return null;
}

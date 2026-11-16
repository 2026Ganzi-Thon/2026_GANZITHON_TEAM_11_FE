import { canUseMock } from '../config/runtime';
import { useEffect } from 'react';
import { startNativeReminderRuntime } from './nativeRuntime';
export function AndroidReminderRuntime() {
  useEffect(() => {
    if (canUseMock()) return startNativeReminderRuntime();
  }, []);
  return null;
}

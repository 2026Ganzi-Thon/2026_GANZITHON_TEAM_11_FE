import { canUseMock } from '../config/runtime';
import { useEffect } from 'react';
import { usePathname } from 'expo-router';
import { startNativeReminderRuntime } from './nativeRuntime';
export function AndroidReminderRuntime() {
  const path = usePathname();
  useEffect(() => {
    if (canUseMock() && path !== '/live') return startNativeReminderRuntime();
  }, [path]);
  return null;
}

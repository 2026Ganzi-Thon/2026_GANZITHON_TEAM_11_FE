import type { ReminderDeviceConnection } from '../../notifications/connection';
export interface Reminder {
  enabled: boolean;
  local_time: string | null;
}
/** A device read projection, independent of the account's desired setting. */
export type ReminderPermission =
  'granted' | 'denied' | 'undetermined' | 'unknown';
export interface ReminderActions {
  device?: ReminderDeviceConnection;
  load(signal: AbortSignal): Promise<Reminder>;
  save(target: Reminder, signal: AbortSignal): Promise<Reminder>;
  readPermission(signal: AbortSignal): Promise<ReminderPermission>;
}

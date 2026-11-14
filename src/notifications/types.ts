export interface ReminderSetting {
  enabled: boolean;
  local_time: string | null;
}
export interface DevicePermission {
  status: 'granted' | 'denied' | 'undetermined';
  canAskAgain: boolean;
  channel: 'enabled' | 'blocked' | 'missing';
}
/** Minimal read projection of the native OS schedule, not account preferences. */
export interface ScheduledReminder {
  id: string;
  daily: boolean;
  channelId: string | null;
  hour: number | null;
  minute: number | null;
  localTime: string | null;
  version: number | null;
  delivery: 'bestEffort' | 'alarmClock' | null;
}
export interface ReminderRequest {
  id: string;
  hour: number;
  minute: number;
  localTime: string;
}
export interface DeviceReminderPort {
  readPermission(): Promise<DevicePermission>;
  requestPermission(): Promise<DevicePermission>;
  ensureChannel(): Promise<void>;
  openSettings(): Promise<void>;
  timeZone(): string;
  list(): Promise<ScheduledReminder[]>;
  schedule(request: ReminderRequest): Promise<string>;
  cancel(id: string): Promise<void>;
}
export type DeviceReminderState =
  | { state: 'off' }
  | { state: 'permission-required'; permission: DevicePermission }
  | { state: 'time-zone-required' }
  | {
      state: 'scheduled';
      id: string;
      localTime: string;
      delivery: 'bestEffort';
    };
export type DeviceReminderErrorCode =
  | 'invalid-setting'
  | 'permission'
  | 'read'
  | 'schedule'
  | 'cancel'
  | 'verification'
  | 'channel'
  | 'settings'
  | 'platform';
export class DeviceReminderError extends Error {
  constructor(readonly code: DeviceReminderErrorCode) {
    super(`Device reminder operation failed: ${code}`);
    this.name = 'DeviceReminderError';
  }
}

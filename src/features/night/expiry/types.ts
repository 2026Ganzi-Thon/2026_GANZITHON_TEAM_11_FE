export interface NightExpirySnapshot {
  server_time: string;
  closes_at: string;
  closed: boolean;
}
/** UI clock/state port, not an additional HTTP endpoint. */
export interface NightExpiryActions {
  load(signal: AbortSignal): Promise<NightExpirySnapshot>;
}

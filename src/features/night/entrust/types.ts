export type EntrustAction = 'entrusted' | 'skipped';
export interface EntrustState {
  item_id: string;
  action: EntrustAction | null;
}
/** Memory-preview projection of one pause slot, not an HTTP feed contract. */
export interface EntrustActions {
  readonly item: { id: string; position: number; worry_text: string };
  load(signal: AbortSignal): Promise<EntrustState>;
  save(action: EntrustAction, signal: AbortSignal): Promise<EntrustState>;
}

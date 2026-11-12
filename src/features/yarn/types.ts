import type { Card } from '../../api/contracts';
/** PUT /cards/{card_id}/yarn response projection (API v0.6). */
export interface YarnResult {
  card_id: string;
  sent: boolean;
}
export interface YarnActions {
  set(cardId: string, sent: boolean, signal: AbortSignal): Promise<YarnResult>;
}
export interface YarnState {
  sent: boolean;
  target: boolean;
  pending: boolean;
  error: 'failed' | 'unavailable' | null;
  notice: 'sent' | 'removed' | null;
}
export interface YarnController {
  stateFor(card: Card): YarnState;
  toggle(card: Card): void;
  retry(card: Card): void;
  start(): void;
  stop(): void;
  subscribe(listener: () => void): () => void;
  getVersion(): number;
}

import type { Card } from '../../api/contracts';
/** Night-scoped PUT /nights/{night_id}/fluff/{card_id} projection. */
export interface FluffActions {
  set(
    cardId: string,
    saved: boolean,
    signal: AbortSignal,
  ): Promise<{
    card_id: string;
    saved: boolean;
  }>;
}
export interface FluffState {
  saved: boolean;
  target: boolean;
  pending: boolean;
  error: 'failed' | 'unavailable' | 'closed' | null;
  notice: 'saved' | 'removed' | null;
}
export interface FluffController {
  stateFor(card: Card): FluffState;
  toggle(card: Card): void;
  retry(card: Card): void;
  start(): void;
  stop(): void;
  hasPending(): boolean;
  isClosed(): boolean;
  subscribe(listener: () => void): () => void;
  getVersion(): number;
}

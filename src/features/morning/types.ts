import type { Card } from '../../api/contracts';

/** API v0.6 §6 projection for the memory-only morning preview. */
export interface MorningCandidate {
  card: Card;
  can_adopt: boolean;
  fluff_saved: boolean;
  position: number | null;
  sheep_count: number;
  last_viewed_at: string;
}
export interface Sheep {
  id: string;
  night_id: string;
  night_date: string;
  card_id: string;
  color_key: string | null;
}
export interface Morning {
  night: { id: string; night_date: string } | null;
  counted_sheep: number | null;
  candidate_cards: MorningCandidate[];
  default_card_id: string | null;
  adoption: Sheep | null;
}
export interface MorningActions {
  loadMorning(signal: AbortSignal): Promise<Morning>;
  adopt(nightId: string, cardId: string, signal: AbortSignal): Promise<Sheep>;
  loadFlock(signal: AbortSignal): Promise<Sheep[]>;
}

import type { WorryDeletions } from '../worries/deletions';
import type { SettingsActions } from '../settings/types';
import type { SongActions } from '../songs/types';
import type { ReflectionActions } from './reflection';
import type { Card } from '../../api/contracts';
import type { CardWritingActions } from '../cards/CardWritingScreen';
import type { ClosingResult } from '../night/closing/types';
import type { ReceivedYarnActions } from '../yarnSummary/types';
import type { FortuneActions } from '../fortune/types';

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
  writing_offer?: ClosingResult['writing_offer'] | null;
  night: { id: string; night_date: string } | null;
  counted_sheep: number | null;
  candidate_cards: MorningCandidate[];
  default_card_id: string | null;
  adoption: Sheep | null;
}
export interface MorningActions {
  worries?: WorryDeletions;
  settings?: SettingsActions;
  fortune?: FortuneActions;
  receivedYarn?: ReceivedYarnActions;
  writing?: CardWritingActions;
  reflection?: ReflectionActions;
  songs?: SongActions;
  loadMorning(signal: AbortSignal, nightId?: string): Promise<Morning>;
  adopt(nightId: string, cardId: string, signal: AbortSignal): Promise<Sheep>;
  loadFlock(signal: AbortSignal): Promise<Sheep[]>;
}

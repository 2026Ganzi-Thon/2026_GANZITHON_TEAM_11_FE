import type { Track } from '../../api/contracts';
export interface SavedSong {
  card_id: string;
  track: Track;
  saved_at: string;
}
/** Night-scoped projection of API v0.6 songs and Morning.saved_songs. */
export interface SongActions {
  load(signal: AbortSignal): Promise<SavedSong[]>;
  set(cardId: string, saved: boolean, signal: AbortSignal): Promise<boolean>;
}
export interface SongExternalActions {
  open(track: Track): Promise<void>;
  copy(track: Track): Promise<void>;
}

import type { Track } from '../../api/contracts';
import type { TextCardCategory } from './types';
export type SongSelection =
  | { mode: 'search'; track: Track }
  | { mode: 'manual'; title: string; artist: string }
  | null;
export interface SongCardDraft {
  category_id: TextCardCategory | null;
  query: string;
  selection: SongSelection;
  recommendation: string;
  operationKey: string;
}
export type SongCardInput = Omit<SongCardDraft, 'operationKey'>;
export interface SongCardRequest {
  kind: 'song';
  category_id: TextCardCategory;
  source_night_id?: string;
  content: { recommendation: string } & (
    | { track_id: string; manual_track?: never }
    | { manual_track: { title: string; artist: string }; track_id?: never }
  );
}
export interface SongCardSubmission {
  id: string;
  kind: 'song';
  category_id: TextCardCategory;
  content: { track: Track; recommendation: string };
  moderation_status: 'pending';
}
export interface SongCardActions {
  search(query: string, signal: AbortSignal): Promise<Track[]>;
  readDraft(): SongCardDraft;
  writeDraft(value: SongCardInput): SongCardDraft;
  submit(
    body: SongCardRequest,
    key: string,
    signal: AbortSignal,
  ): Promise<SongCardSubmission>;
}
export const PREVIEW_RECOMMENDATION_LIMIT = 50;
export const trimmedLength = (value: string) => Array.from(value.trim()).length;
export function validSelection(value: SongSelection): boolean {
  if (!value) return false;
  if (value.mode === 'search')
    return (
      !!value.track.id.trim() &&
      !!value.track.title.trim() &&
      !!value.track.artist.trim()
    );
  return [value.title, value.artist].every(
    (v) => trimmedLength(v) > 0 && trimmedLength(v) <= 200,
  );
}

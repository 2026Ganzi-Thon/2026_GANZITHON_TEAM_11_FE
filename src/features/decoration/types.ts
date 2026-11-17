import type { Sheep } from '../morning/types';
export interface Placement {
  instance_id: string;
  sticker_id: string;
  x: number;
  y: number;
  rotation: number;
  scale: number;
}
export type StickerShape =
  'star' | 'circle' | 'triangle' | 'sparkle' | 'diamond';
/** Local asset projection; asset_url mapping is deferred with HTTP integration. */
export interface Sticker {
  id: string;
  label: string;
  asset_key: StickerShape;
}
export interface DecoratedSheep extends Sheep {
  version: number;
  placements: Placement[];
}
export interface DecorationData {
  sheep: DecoratedSheep;
  stickers: Sticker[];
}
export interface DecorationWrite {
  if_version: number;
  placements: Placement[];
}
export interface DecorationActions {
  load(id: string, signal: AbortSignal): Promise<DecorationData>;
  save(
    id: string,
    input: DecorationWrite,
    signal: AbortSignal,
  ): Promise<DecoratedSheep>;
}

import type { StickerShape } from './types';
/** Fixed preview asset keys. The HTTP catalog adapter will resolve asset_url separately. */
export function mockStickerShape(id: string): StickerShape | undefined {
  const keys: Record<string, StickerShape> = {
    'st-1': 'star',
    'st-2': 'circle',
    'st-3': 'triangle',
    'st-4': 'sparkle',
    'st-5': 'diamond',
    'st-6': 'circle',
    'st-7': 'triangle',
  };
  return Object.hasOwn(keys, id) ? keys[id] : undefined;
}

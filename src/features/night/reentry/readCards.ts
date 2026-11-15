import type { Card } from '../../../api/contracts';
import { ApiError } from '../../../api/errors';
import { isId } from './model';
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const nullableText = (value: unknown) =>
  value === null || typeof value === 'string';
function card(value: unknown): value is Card {
  if (
    !object(value) ||
    !isId(value.id) ||
    typeof value.available !== 'boolean' ||
    !['text', 'song'].includes(value.kind as string) ||
    !nullableText(value.category_id) ||
    !(
      value.tone === null ||
      ['empathy', 'light', 'warm'].includes(value.tone as string)
    ) ||
    !['user', 'seed', 'editorial', 'mongchi', 'ai'].includes(
      value.author_type as string,
    ) ||
    !nullableText(value.author_label) ||
    !object(value.viewer) ||
    !['yarn_sent', 'fluff_saved', 'song_saved'].every(
      (key) =>
        typeof (value.viewer as Record<string, unknown>)[key] === 'boolean',
    )
  )
    return false;
  if (value.content === null) return true;
  if (!object(value.content)) return false;
  if (value.kind === 'text') return typeof value.content.text === 'string';
  const track = value.content.track;
  return (
    object(track) &&
    isId(track.id) &&
    typeof track.title === 'string' &&
    typeof track.artist === 'string' &&
    nullableText(track.cover_url) &&
    typeof track.spotify_search_url === 'string' &&
    nullableText(value.content.recommendation)
  );
}
export function readReentryCards(value: unknown, count: number): Card[] {
  if (
    !Array.isArray(value) ||
    value.length !== count ||
    !value.every(card) ||
    new Set(value.map((item) => item.id)).size !== value.length
  )
    throw new ApiError('invalid-response');
  return value;
}

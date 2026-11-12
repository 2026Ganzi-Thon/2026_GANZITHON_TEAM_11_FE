import type { Card } from '../../../api/contracts';
export type FeedLoad = (signal: AbortSignal) => Promise<Card[]>;
export type FeedPosition = { position: number; furthestPosition: number };
export function movePosition(
  current: FeedPosition,
  delta: -1 | 1,
  total: number,
): FeedPosition {
  const position = Math.max(1, Math.min(total, current.position + delta));
  return {
    position,
    furthestPosition: Math.max(current.furthestPosition, position),
  };
}
export function swipeDirection(dx: number, dy: number): -1 | 0 | 1 {
  if (Math.abs(dy) < 40 || Math.abs(dy) < Math.abs(dx) * 1.4) return 0;
  return dy < 0 ? 1 : -1;
}

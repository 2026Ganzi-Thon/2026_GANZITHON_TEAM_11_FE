import { describe, expect, it } from '@jest/globals';
import { movePosition, swipeDirection } from './model';
describe('feed movement', () => {
  it('bounds the current position and preserves furthest reach when moving back', () => {
    expect(movePosition({ position: 1, furthestPosition: 1 }, -1, 3)).toEqual({
      position: 1,
      furthestPosition: 1,
    });
    expect(movePosition({ position: 1, furthestPosition: 1 }, 1, 3)).toEqual({
      position: 2,
      furthestPosition: 2,
    });
    expect(movePosition({ position: 3, furthestPosition: 3 }, -1, 3)).toEqual({
      position: 2,
      furthestPosition: 3,
    });
    expect(movePosition({ position: 3, furthestPosition: 3 }, 1, 3)).toEqual({
      position: 3,
      furthestPosition: 3,
    });
  });
  it('maps vertical swipes to one step and rejects short or horizontal drags', () => {
    expect(swipeDirection(10, -60)).toBe(1);
    expect(swipeDirection(10, 60)).toBe(-1);
    expect(swipeDirection(0, -20)).toBe(0);
    expect(swipeDirection(80, -60)).toBe(0);
  });
});

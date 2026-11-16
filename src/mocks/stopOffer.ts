import { stopOfferPosition } from '../features/night/stopOffer/model';
import type {
  ClosingActions,
  ClosingRequest,
} from '../features/night/closing/types';
import { createMockNightClosing, type ClosingScenario } from './nightClosing';
/** Standalone scene only; no feed progress or account record is changed. */
export function createMockStopOffer(
  sheepCount = 20,
  scenario: ClosingScenario = 'success',
): { input: ClosingRequest; closing: ClosingActions } | null {
  const position = stopOfferPosition(sheepCount);
  if (position === null) return null;
  return {
    input: {
      reason: 'leave',
      position,
      furthestPosition: position,
      sheepCount,
    },
    closing: createMockNightClosing(scenario),
  };
}

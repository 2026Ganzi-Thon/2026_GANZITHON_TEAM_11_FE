import type { Card, NightSummary } from '../../../api/contracts';

/** Preview adapter only. Server progress ownership and persistence are not connected. */
export type ClosingRequest = {
  reason: 'completed' | 'leave';
  position: number;
  furthestPosition: number;
  sheepCount: number;
};
export type ClosingResult = {
  summary: Pick<NightSummary, 'counted' | 'entrusted_count' | 'fluff_count'>;
  closing_card: Card | null;
  writing_offer: { state: 'offered' | 'writing' | 'deferred' | 'fulfilled' };
};
export type WritingChoice = 'now' | 'morning';
export interface ClosingActions {
  finish(
    input: ClosingRequest,
    operationKey: string,
    signal: AbortSignal,
  ): Promise<ClosingResult>;
  markViewed(
    cardId: string,
    operationKey: string,
    signal: AbortSignal,
  ): Promise<void>;
  chooseWriting(
    choice: WritingChoice,
    operationKey: string,
    signal: AbortSignal,
  ): Promise<void>;
}

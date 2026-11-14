import type { Card } from '../../api/contracts';
import type { CardWritingActions } from '../cards/CardWritingScreen';

export type ModerationStatus = 'pending' | 'approved' | 'rejected';
export type MyCardsFilter = 'all' | 'pending' | 'rejected';
interface SubmissionBase {
  id: string;
  category_id: string;
  moderation_status: ModerationStatus;
  rejection_reason: string | null;
  yarn_count: number;
  created_at: string;
  revision: number;
}
/** Read-only projection of API v0.6 §11 Submission. */
export type Submission = SubmissionBase &
  (
    | {
        kind: 'text';
        content: NonNullable<Extract<Card, { kind: 'text' }>['content']>;
      }
    | {
        kind: 'song';
        content: NonNullable<Extract<Card, { kind: 'song' }>['content']>;
      }
  );
export interface SubmissionPage {
  items: Submission[];
  next_cursor: string | null;
}
export interface MyCardsQuery {
  status?: ModerationStatus;
  cursor?: string;
}
export interface MyCardsActions {
  load(query: MyCardsQuery, signal: AbortSignal): Promise<SubmissionPage>;
}

/** DELETE /me/cards/{id}: confirmed success has no response body. */
export interface MyCardDeleteActions {
  remove(cardId: string, signal: AbortSignal): Promise<void>;
}
export interface MyCardsWritingSource
  extends MyCardsActions, MyCardDeleteActions {
  createWritingSession(): CardWritingActions;
}

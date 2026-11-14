import type { Card } from '../../api/contracts';
import type { TextCardDraft, TextCardSubmission } from '../cards/types';
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
  extends MyCardsActions, MyCardDeleteActions, MyCardResubmitActions {
  createWritingSession(): CardWritingActions;
}

export type RejectedTextCard = Extract<Submission, { kind: 'text' }>;
export interface TextCardResubmitRequest {
  kind: 'text';
  category_id: NonNullable<TextCardDraft['category_id']>;
  content: { text: string };
}
/** Same card ID, separate from a new night's writing offer. */
export interface MyCardResubmitActions {
  readDraft(item: RejectedTextCard): TextCardDraft;
  writeDraft(
    id: string,
    value: Pick<TextCardDraft, 'category_id' | 'text'>,
  ): TextCardDraft;
  clearDraft(id: string): void;
  resubmit(
    id: string,
    body: TextCardResubmitRequest,
    key: string,
    signal: AbortSignal,
  ): Promise<TextCardSubmission>;
}

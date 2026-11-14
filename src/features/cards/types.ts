import type { CategoryId } from '../night/entry';
export type TextCardCategory = Exclude<CategoryId, 'none'>;
export interface TextCardDraft {
  category_id: TextCardCategory | null;
  text: string;
  operationKey: string;
}
export interface TextCardRequest {
  kind: 'text';
  category_id: TextCardCategory;
  content: { text: string };
  source_night_id?: string;
}
/** Initial POST /cards response projection; pending is not moderation approval. */
export interface TextCardSubmission {
  id: string;
  kind: 'text';
  category_id: TextCardCategory;
  content: { text: string };
  moderation_status: 'pending';
}
export interface TextCardActions {
  readDraft(): TextCardDraft;
  writeDraft(value: Pick<TextCardDraft, 'category_id' | 'text'>): TextCardDraft;
  submit(
    value: TextCardRequest,
    key: string,
    signal: AbortSignal,
  ): Promise<TextCardSubmission>;
}
export const PREVIEW_TEXT_CARD_LIMIT = 200;
export const textCardLength = (value: string) =>
  Array.from(value.trim()).length;

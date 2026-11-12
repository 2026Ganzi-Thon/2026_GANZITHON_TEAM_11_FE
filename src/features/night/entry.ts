export type CategoryId =
  | 'romance'
  | 'career'
  | 'study'
  | 'health'
  | 'relationships'
  | 'family'
  | 'other'
  | 'none';
export type WorryDraft = { category_id: CategoryId; worry_text: string | null };
export type NightEntryActions = {
  checkWorry: (draft: WorryDraft, signal: AbortSignal) => Promise<void>;
  startCounting: (count: number, signal: AbortSignal) => Promise<void>;
};
// Provisional preview limit; reconcile with the server contract before integration.
export const PREVIEW_WORRY_LIMIT = 200;
export function validateWorry(
  category: CategoryId | null,
  text: string,
  limit: number,
): string | null {
  if (!category) return '고민 종류를 골라 주세요.';
  if (category === 'none') return null;
  if (!text.trim()) return '고민을 한두 줄 적어 주세요.';
  if (text.length > limit) return `${limit}자 이내로 적어 주세요.`;
  return null;
}
export function changeSheepCount(count: number, delta: number): number {
  return Math.min(30, Math.max(3, count + delta));
}

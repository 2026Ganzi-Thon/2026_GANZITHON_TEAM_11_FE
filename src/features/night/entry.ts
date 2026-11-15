import type { Support } from '../../api/contracts';
import { ApiError } from '../../api/errors';
import { readSupport } from '../support/model';
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
/** First-entry UI projections. Reconnection and active-session resume are separate flows. */
export interface NightWorryResult {
  id: string;
  status: 'ready' | 'needs_support';
  support: Support | null;
}
export interface NightSupportContinue {
  id: string;
  active_session_id: string | null;
}
export function readNightWorryResult(
  value: NightWorryResult,
): NightWorryResult {
  if (
    !value ||
    typeof value.id !== 'string' ||
    !value.id.trim() ||
    (value.status !== 'ready' && value.status !== 'needs_support') ||
    (value.status === 'ready' && value.support !== null)
  )
    throw new ApiError('invalid-response');
  return {
    id: value.id,
    status: value.status,
    support:
      value.status === 'needs_support' ? readSupport(value.support) : null,
  };
}
export type NightEntryActions = {
  checkWorry: (
    draft: WorryDraft,
    signal: AbortSignal,
  ) => Promise<NightWorryResult>;
  continueSupport: (
    nightId: string,
    signal: AbortSignal,
  ) => Promise<NightSupportContinue>;
  startCounting: (count: number, signal: AbortSignal) => Promise<void>;
};
/** Only explicit input validation confirms that creation was rejected. */
export function isSheepCountRejection(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.kind === 'http' &&
    error.status === 422 &&
    (error.code === 'INVALID_SHEEP_COUNT' || error.code === 'VALIDATION_ERROR')
  );
}
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

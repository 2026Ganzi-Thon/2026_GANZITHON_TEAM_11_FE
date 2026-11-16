import { ApiError } from '../../../api/errors';
export interface PasswordResetActions {
  request(email: string, signal: AbortSignal): Promise<unknown>;
}
export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export function emailIssue(email: string): string | undefined {
  const value = normalizeEmail(email);
  if (!value) return '이메일 주소를 입력해 주세요.';
  if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    return '이메일 주소를 확인해 주세요.';
}
export function assertResetAccepted(value: unknown): void {
  if (
    !value ||
    typeof value !== 'object' ||
    !('accepted' in value) ||
    value.accepted !== true
  )
    throw new ApiError('invalid-response');
}
export function retryDeadline(
  value: string | undefined,
  now: number,
): number | null {
  const raw = value?.trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) {
    const deadline = now + Number(raw) * 1000;
    return Number.isSafeInteger(deadline) ? deadline : null;
  }
  if (
    !/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(
      raw,
    )
  )
    return null;
  const deadline = Date.parse(raw);
  return Number.isFinite(deadline) && new Date(deadline).toUTCString() === raw
    ? Math.max(now, deadline)
    : null;
}

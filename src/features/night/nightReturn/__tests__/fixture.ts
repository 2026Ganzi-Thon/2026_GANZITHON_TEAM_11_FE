import type { NightSummary } from '../../../../api/contracts';
import type { ReturnBootstrap, NightReturnRecord } from '../model';
export const lastSession = (
  patch: Partial<NightSummary> = {},
): NightSummary => ({
  counted: 15,
  status: 'completed',
  finished_at: '2026-11-16T16:12:00Z',
  entrusted_count: 1,
  fluff_count: 2,
  yarn_sent_count: 1,
  closing_card: null,
  ...patch,
});
export const snapshot = (
  patch: Partial<ReturnBootstrap> = {},
): ReturnBootstrap => ({
  server_time: '2026-11-16T17:10:00Z',
  timezone: 'Asia/Seoul',
  phase: 'night',
  night_date: '2026-11-16',
  next_screen: 'NIGHT_RETURN',
  night_id: 'return-night',
  active_session_id: null,
  last_session: lastSession(),
  ...patch,
});
export function returnRecord(
  patch: Partial<NightSummary> = {},
  nightId = 'return-night',
): NightReturnRecord {
  const { closing_card: _card, ...summary } = lastSession(patch);
  return { nightId, summary };
}

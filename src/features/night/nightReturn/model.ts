import type { Bootstrap, NightSummary } from '../../../api/contracts';
import { ApiError } from '../../../api/errors';
import { parseDate } from '../../birthDate/date';
import { fortuneDate, homePhase } from '../../home/model';
export type ReturnBootstrap = Pick<
  Bootstrap,
  | 'server_time'
  | 'timezone'
  | 'phase'
  | 'night_date'
  | 'next_screen'
  | 'night_id'
  | 'active_session_id'
  | 'last_session'
>;
export interface NightReturnRecord {
  nightId: string;
  summary: Omit<NightSummary, 'closing_card'>;
}
export type ReturnRoute =
  | { kind: 'return'; record: NightReturnRecord }
  | { kind: 'feed'; nightId: string; sessionId: string }
  | { kind: 'closing'; nightId: string }
  | { kind: 'morning'; nightId: string | null }
  | { kind: 'entry'; step: 'worry' | 'count'; nightId: string | null }
  | { kind: 'support'; nightId: string }
  | { kind: 'home' };
function invalid(): never {
  throw new ApiError('invalid-response');
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return invalid();
  return value as Record<string, unknown>;
}
const id = (v: unknown): v is string => typeof v === 'string' && !!v.trim();
const nullableId = (v: unknown): v is string | null => v === null || id(v);
function instant(value: unknown): number {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    ) ||
    !parseDate(value.slice(0, 10))
  )
    return invalid();
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : invalid();
}
function readSummary(
  value: unknown,
  now: number,
  nightDate: string,
): NightReturnRecord['summary'] {
  const v = object(value);
  if (
    !['completed', 'stopped'].includes(v.status as string) ||
    v.closing_card !== null ||
    !['counted', 'entrusted_count', 'fluff_count', 'yarn_sent_count'].every(
      (key) =>
        typeof v[key] === 'number' &&
        Number.isSafeInteger(v[key]) &&
        (v[key] as number) >= 0,
    )
  )
    return invalid();
  const finished = instant(v.finished_at);
  if (
    finished > now ||
    homePhase(finished) !== 'night' ||
    fortuneDate(finished) !== nightDate
  )
    return invalid();
  return {
    counted: v.counted as number,
    status: v.status as NightSummary['status'],
    finished_at: v.finished_at as string,
    entrusted_count: v.entrusted_count as number,
    fluff_count: v.fluff_count as number,
    yarn_sent_count: v.yarn_sent_count as number,
  };
}
/** Read-only bootstrap routing; session creation belongs to the caller. */
export function readNightReturnRoute(value: unknown): ReturnRoute {
  const v = object(value),
    now = instant(v.server_time);
  if (
    v.timezone !== 'Asia/Seoul' ||
    v.phase !== homePhase(now) ||
    v.night_date !== fortuneDate(now) ||
    !nullableId(v.night_id) ||
    !nullableId(v.active_session_id)
  )
    return invalid();
  const nightId = v.night_id;
  if (v.phase === 'day') {
    if (v.next_screen !== 'HOME' && v.next_screen !== 'MORNING_ADOPTION')
      return invalid();
    return { kind: 'morning', nightId };
  }
  if (v.next_screen === 'HOME') return { kind: 'home' };
  if (
    (v.next_screen === 'NIGHT_WORRY' ||
      v.next_screen === 'NIGHT_SHEEP_COUNT') &&
    v.last_session !== null &&
    object(v.last_session).closing_card !== null
  )
    return invalid();
  if (v.next_screen === 'NIGHT_WORRY' && v.active_session_id === null)
    return { kind: 'entry', step: 'worry', nightId };
  if (!id(nightId)) return invalid();
  if (v.next_screen === 'NIGHT_SUPPORT') return { kind: 'support', nightId };
  if (v.next_screen === 'NIGHT_FEED' && id(v.active_session_id))
    return { kind: 'feed', nightId, sessionId: v.active_session_id };
  if (v.active_session_id !== null) return invalid();
  if (v.next_screen === 'NIGHT_SHEEP_COUNT')
    return { kind: 'entry', step: 'count', nightId };
  if (v.next_screen === 'NIGHT_CLOSING') return { kind: 'closing', nightId };
  if (v.next_screen !== 'NIGHT_RETURN') return invalid();
  return {
    kind: 'return',
    record: {
      nightId,
      summary: readSummary(v.last_session, now, v.night_date as string),
    },
  };
}
export function returnRecordKey(record: NightReturnRecord): string {
  const s = record.summary;
  return JSON.stringify([
    record.nightId,
    s.finished_at,
    s.status,
    s.counted,
    s.entrusted_count,
    s.fluff_count,
    s.yarn_sent_count,
  ]);
}

export interface NightReturnActions {
  load(signal: AbortSignal): Promise<ReturnBootstrap>;
}

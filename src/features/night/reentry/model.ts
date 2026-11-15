import type { Bootstrap, Card, Support } from '../../../api/contracts';
import { ApiError } from '../../../api/errors';
import { readSupport } from '../../support/model';
import type {
  NightSupportContinue,
  NightWorryResult,
  WorryDraft,
} from '../entry';
import type { FeedPosition } from '../feed/model';

/** Explicit reentry preview projections; not a complete application bootstrap router. */
export type ReentryBootstrap = Pick<
  Bootstrap,
  'phase' | 'next_screen' | 'night_id' | 'active_session_id' | 'support'
>;
export type ReentryRoute = {
  phase: 'night';
  next_screen:
    'NIGHT_WORRY' | 'NIGHT_SHEEP_COUNT' | 'NIGHT_FEED' | 'NIGHT_SUPPORT';
  night_id: string | null;
  active_session_id: string | null;
  support: Support | null;
};
export interface ReentrySession {
  id: string;
  night_id: string;
  status: 'active';
  sheep_count: number;
  position: number;
  furthest_position: number;
  sequence: number;
  writer_epoch: number;
}
export interface ReentryActions {
  bootstrap: (signal: AbortSignal) => Promise<ReentryBootstrap>;
  checkWorry: (
    draft: WorryDraft,
    signal: AbortSignal,
  ) => Promise<NightWorryResult>;
  continueSupport: (
    nightId: string,
    signal: AbortSignal,
  ) => Promise<NightSupportContinue>;
  createSession: (
    nightId: string,
    count: number,
    signal: AbortSignal,
  ) => Promise<ReentrySession>;
  resume: (sessionId: string, signal: AbortSignal) => Promise<ReentrySession>;
  loadFeed: (sessionId: string, signal: AbortSignal) => Promise<Card[]>;
  /** In-memory preview only. This is not a persistent/offline progress queue. */
  rememberPosition: (session: ReentrySession, position: FeedPosition) => void;
}
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
export const isId = (value: unknown): value is string =>
  typeof value === 'string' && !!value.trim();
const nullableId = (value: unknown) => value === null || isId(value);
const integer = (
  value: unknown,
  min: number,
  max = Number.MAX_SAFE_INTEGER,
): value is number =>
  typeof value === 'number' &&
  Number.isSafeInteger(value) &&
  value >= min &&
  value <= max;

export function readReentryRoute(value: unknown): ReentryRoute {
  const data = record(value),
    next = data.next_screen;
  if (
    data.phase === 'day' ||
    [
      'ONBOARDING_CONSENT',
      'ONBOARDING_BIRTH_DATE',
      'DAY_INTRO',
      'MORNING_ADOPTION',
      'HOME',
      'NIGHT_CLOSING',
      'NIGHT_RETURN',
    ].includes(next as string)
  )
    throw new ApiError('configuration', { code: 'REENTRY_UNSUPPORTED' });
  if (
    data.phase !== 'night' ||
    ![
      'NIGHT_WORRY',
      'NIGHT_SHEEP_COUNT',
      'NIGHT_FEED',
      'NIGHT_SUPPORT',
    ].includes(next as string) ||
    !nullableId(data.night_id) ||
    !nullableId(data.active_session_id) ||
    (next !== 'NIGHT_WORRY' && !isId(data.night_id)) ||
    (next === 'NIGHT_FEED' && !isId(data.active_session_id)) ||
    ((next === 'NIGHT_WORRY' || next === 'NIGHT_SHEEP_COUNT') &&
      data.active_session_id !== null) ||
    (next !== 'NIGHT_SUPPORT' && data.support !== null)
  )
    throw new ApiError('invalid-response');
  return {
    phase: 'night',
    next_screen: next as ReentryRoute['next_screen'],
    night_id: data.night_id as string | null,
    active_session_id: data.active_session_id as string | null,
    support: next === 'NIGHT_SUPPORT' ? readSupport(data.support) : null,
  };
}

export function readReentrySession(
  value: unknown,
  nightId: string,
  sessionId?: string,
): ReentrySession {
  const data = record(value);
  if (
    !isId(data.id) ||
    (sessionId !== undefined && data.id !== sessionId) ||
    data.night_id !== nightId ||
    data.status !== 'active' ||
    !integer(data.sheep_count, 3, 30) ||
    !integer(data.position, 0, data.sheep_count) ||
    !integer(data.furthest_position, data.position, data.sheep_count) ||
    (data.position === 0 && data.furthest_position !== 0) ||
    data.sequence !== 0 ||
    !integer(data.writer_epoch, 1)
  )
    throw new ApiError('invalid-response');
  return {
    id: data.id,
    night_id: nightId,
    status: 'active',
    sheep_count: data.sheep_count,
    position: data.position,
    furthest_position: data.furthest_position,
    sequence: data.sequence,
    writer_epoch: data.writer_epoch,
  };
}

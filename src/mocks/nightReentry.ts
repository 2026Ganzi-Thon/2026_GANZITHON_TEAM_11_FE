import { ApiError } from '../api/errors';
import type {
  ReentryActions,
  ReentryBootstrap,
  ReentrySession,
} from '../features/night/reentry/model';
import { createMockNightFeed } from './nightFeed';
import { createMockSupport } from './support';

export type ReentryScenario =
  | 'active'
  | 'untouched'
  | 'recorded'
  | 'new'
  | 'support-active'
  | 'support-count'
  | 'support-missing'
  | 'long-support'
  | 'continue-retry'
  | 'resume-retry'
  | 'resume-lost-response'
  | 'slow-continue'
  | 'slow-resume'
  | 'closed-session'
  | 'feed-retry'
  | 'bootstrap-retry';
/** An explicit reentry simulation only. Discarding this source discards its records. */
export function createMockNightReentry(
  scenario: ReentryScenario,
): ReentryActions {
  const nightId = 'reentry-night';
  let recorded = scenario !== 'new',
    continued = false,
    expired = false,
    failed = false,
    bootstrapCalls = 0;
  const needsSupport = [
    'support-active',
    'support-count',
    'support-missing',
    'long-support',
    'continue-retry',
    'slow-continue',
  ].includes(scenario);
  let session: ReentrySession | null =
    !recorded || scenario === 'recorded' || scenario === 'support-count'
      ? null
      : {
          id: 'reentry-session-1',
          night_id: nightId,
          status: 'active',
          sheep_count: 6,
          position: scenario === 'untouched' ? 0 : 2,
          furthest_position: scenario === 'untouched' ? 0 : 4,
          sequence: 0,
          writer_epoch: 1,
        };
  const conflict = (code: string, status = 409): never => {
    throw new ApiError('http', { status, code });
  };
  function respond<T>(
    step: 'bootstrap' | 'continue' | 'resume' | 'create' | 'worry' | 'feed',
    signal: AbortSignal,
    action: () => T,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new ApiError('aborted'));
        return;
      }
      const cleanup = () => {
        clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
      };
      const onAbort = () => {
        cleanup();
        reject(new ApiError('aborted'));
      };
      const timer = setTimeout(
        () => {
          cleanup();
          try {
            if (scenario === `${step}-retry` && !failed) {
              failed = true;
              throw new ApiError('network');
            }
            resolve(action());
          } catch (error) {
            reject(error);
          }
        },
        scenario === `slow-${step}` ? 5000 : 600,
      );
      signal.addEventListener('abort', onAbort, { once: true });
    });
  }
  return {
    bootstrap: (signal) =>
      respond<ReentryBootstrap>('bootstrap', signal, () => {
        bootstrapCalls++;
        if (expired)
          return {
            phase: 'day',
            next_screen: 'HOME',
            night_id: nightId,
            active_session_id: null,
            support: null,
          };
        const support = createMockSupport();
        support.message =
          '아까 보던 곳에서 다시 시작해도 괜찮아요. 필요하면 이야기를 들어 줄 사람에게 먼저 연락해요.';
        if (scenario === 'long-support')
          support.message =
            '혼자 버티지 않아도 돼요. 필요하면 이야기를 들어 줄 사람에게 먼저 연락해 보세요. '.repeat(
              8,
            );
        return {
          phase: 'night',
          next_screen: !recorded
            ? 'NIGHT_WORRY'
            : needsSupport
              ? 'NIGHT_SUPPORT'
              : session
                ? 'NIGHT_FEED'
                : 'NIGHT_SHEEP_COUNT',
          night_id: recorded ? nightId : null,
          active_session_id: session?.id ?? null,
          support:
            needsSupport &&
            !(scenario === 'support-missing' && bootstrapCalls === 1)
              ? support
              : null,
        };
      }),
    checkWorry: (_draft, signal) =>
      respond('worry', signal, () => {
        if (recorded) conflict('WORRY_ALREADY_RECORDED');
        recorded = true;
        return { id: nightId, status: 'ready' as const, support: null };
      }),
    continueSupport: (id, signal) =>
      respond('continue', signal, () => {
        if (id !== nightId) conflict('NIGHT_NOT_FOUND', 404);
        if (!needsSupport || !recorded) conflict('SUPPORT_NOT_REQUIRED');
        continued = true;
        return { id: nightId, active_session_id: session?.id ?? null };
      }),
    createSession: (id, count, signal) =>
      respond('create', signal, () => {
        if (id !== nightId || !recorded) conflict('NIGHT_NOT_FOUND', 404);
        if (needsSupport && !continued) conflict('SUPPORT_REQUIRED');
        if (session) conflict('ACTIVE_SESSION_EXISTS');
        if (!Number.isInteger(count) || count < 3 || count > 30)
          conflict('INVALID_SHEEP_COUNT', 422);
        session = {
          id: 'reentry-session-1',
          night_id: nightId,
          status: 'active',
          sheep_count: count,
          position: 0,
          furthest_position: 0,
          sequence: 0,
          writer_epoch: 1,
        };
        return { ...session };
      }),
    resume: (id, signal) =>
      respond('resume', signal, () => {
        if (!session || id !== session.id)
          return conflict('SESSION_NOT_FOUND', 404);
        if (scenario === 'closed-session') {
          session = null;
          expired = true;
          return conflict('SESSION_CLOSED');
        }
        session = {
          ...session,
          writer_epoch: session.writer_epoch + 1,
          sequence: 0,
        };
        if (scenario === 'resume-lost-response' && !failed) {
          failed = true;
          throw new ApiError('network');
        }
        return { ...session };
      }),
    loadFeed: async (id, signal) => {
      const load = await respond('feed', signal, () => {
        if (!session || id !== session.id)
          return conflict('SESSION_NOT_FOUND', 404);
        return createMockNightFeed(session.sheep_count);
      });
      return load(signal);
    },
    rememberPosition: (source, value) => {
      if (
        !session ||
        source.id !== session.id ||
        source.night_id !== nightId ||
        source.writer_epoch !== session.writer_epoch
      )
        return;
      if (
        !Number.isInteger(value.position) ||
        !Number.isInteger(value.furthestPosition) ||
        value.position < 1 ||
        value.furthestPosition < value.position ||
        value.furthestPosition > session.sheep_count
      )
        return;
      session = {
        ...session,
        position: value.position,
        furthest_position: Math.max(
          session.furthest_position,
          value.furthestPosition,
        ),
        sequence: session.sequence + 1,
      };
    },
  };
}

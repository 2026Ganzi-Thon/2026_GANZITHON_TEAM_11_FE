import { ApiError } from '../api/errors';
import type {
  NightReturnActions,
  ReturnBootstrap,
} from '../features/night/nightReturn/model';
export type NightReturnScenario =
  | 'completed'
  | 'stopped'
  | 'unentrusted'
  | 'initial-error'
  | 'retry'
  | 'slow'
  | 'changed'
  | 'expired-on-check'
  | 'active-on-check'
  | 'closing'
  | 'support'
  | 'day';
/** Read-only memory fixture. It owns no session-creation or account-write port. */
export function createMockNightReturn(
  scenario: NightReturnScenario = 'completed',
): NightReturnActions {
  let calls = 0;
  const base: ReturnBootstrap = {
    server_time: '2026-11-16T17:10:00Z',
    timezone: 'Asia/Seoul',
    phase: 'night',
    night_date: '2026-11-16',
    next_screen: 'NIGHT_RETURN',
    night_id: 'return-night',
    active_session_id: null,
    last_session: {
      counted: 15,
      status: 'completed',
      finished_at: '2026-11-16T16:12:00Z',
      entrusted_count: 1,
      fluff_count: 2,
      yarn_sent_count: 1,
      closing_card: null,
    },
  };
  const read = (call: number): ReturnBootstrap => {
    if (
      (scenario === 'initial-error' && call === 1) ||
      (scenario === 'retry' && call === 2)
    )
      throw new ApiError('network');
    const value = JSON.parse(JSON.stringify(base)) as ReturnBootstrap;
    if (scenario === 'stopped') {
      value.last_session!.status = 'stopped';
      value.last_session!.counted = 14;
    }
    if (scenario === 'unentrusted') value.last_session!.entrusted_count = 0;
    if (scenario === 'changed' && call >= 2) {
      value.last_session!.counted = 20;
      value.last_session!.finished_at = '2026-11-16T16:30:00Z';
    }
    if (scenario === 'day' || (scenario === 'expired-on-check' && call >= 2)) {
      value.server_time = '2026-11-16T19:00:00Z';
      value.phase = 'day';
      value.night_date = '2026-11-17';
      value.next_screen = 'MORNING_ADOPTION';
    }
    if (scenario === 'active-on-check' && call >= 2) {
      value.next_screen = 'NIGHT_FEED';
      value.active_session_id = 'return-active';
    }
    if (scenario === 'closing') value.next_screen = 'NIGHT_CLOSING';
    if (scenario === 'support') value.next_screen = 'NIGHT_SUPPORT';
    return value;
  };
  return {
    load: (signal) =>
      new Promise((resolve, reject) => {
        const call = ++calls;
        if (signal.aborted) {
          reject(new ApiError('aborted'));
          return;
        }
        const cleanup = () => {
          clearTimeout(timer);
          signal.removeEventListener('abort', abort);
        };
        const abort = () => {
          cleanup();
          reject(new ApiError('aborted'));
        };
        const timer = setTimeout(
          () => {
            cleanup();
            try {
              resolve(read(call));
            } catch (error) {
              reject(error);
            }
          },
          scenario === 'slow' ? 5000 : 500,
        );
        signal.addEventListener('abort', abort, { once: true });
      }),
  };
}

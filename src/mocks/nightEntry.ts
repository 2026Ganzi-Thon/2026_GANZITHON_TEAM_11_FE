import { ApiError } from '../api/errors';
import type {
  NightEntryActions,
  NightWorryResult,
} from '../features/night/entry';
import { createMockSupport } from './support';
export type NightEntryScenario =
  | 'success'
  | 'worry-retry'
  | 'count-retry'
  | 'support'
  | 'continue-retry'
  | 'continue-lost-response'
  | 'slow-continue'
  | 'support-missing'
  | 'support-reload-retry'
  | 'support-long';
/** Fixed scenarios, not input analysis. No network, bootstrap, resume or persistent account. */
export function createMockNightEntry(
  scenario: NightEntryScenario,
): NightEntryActions {
  const nightId = 'preview-night-entry';
  const requiresSupport = !['success', 'worry-retry', 'count-retry'].includes(
    scenario,
  );
  let failedOnce = false,
    continued = false,
    checked = 0;
  function respond<T>(
    step: 'worry' | 'count' | 'continue',
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
      const delay =
        scenario === 'slow-continue' && step === 'continue' ? 5000 : 800;
      const timer = setTimeout(() => {
        cleanup();
        try {
          if (!failedOnce && scenario === `${step}-retry`) {
            failedOnce = true;
            throw new ApiError('network');
          }
          resolve(action());
        } catch (error) {
          reject(error);
        }
      }, delay);
      signal.addEventListener('abort', onAbort, { once: true });
    });
  }
  return {
    checkWorry: (_draft, signal) =>
      respond<NightWorryResult>('worry', signal, () => {
        checked++;
        if (scenario === 'support-reload-retry' && checked === 2)
          throw new ApiError('network');
        if (!requiresSupport)
          return { id: nightId, status: 'ready', support: null };
        const support = createMockSupport();
        support.message =
          '양 세기는 잠시 멈추고, 이야기를 들어 줄 사람과 먼저 연결해요.';
        if (scenario === 'support-long')
          support.message =
            '혼자 버티지 않아도 돼요. 필요하면 이야기를 들어 줄 사람에게 연락해 보세요. '.repeat(
              8,
            );
        const missing =
          (scenario === 'support-missing' ||
            scenario === 'support-reload-retry') &&
          checked === 1;
        return {
          id: nightId,
          status: 'needs_support',
          support: missing ? null : support,
        };
      }),
    continueSupport: (id, signal) =>
      respond('continue', signal, () => {
        if (id !== nightId)
          throw new ApiError('http', { status: 404, code: 'NIGHT_NOT_FOUND' });
        if (!requiresSupport || checked === 0)
          throw new ApiError('http', {
            status: 409,
            code: 'SUPPORT_NOT_REQUIRED',
          });
        continued = true;
        if (scenario === 'continue-lost-response' && !failedOnce) {
          failedOnce = true;
          throw new ApiError('network');
        }
        return { id: nightId, active_session_id: null };
      }),
    startCounting: (_count, signal) =>
      respond('count', signal, () => {
        if (requiresSupport && !continued)
          throw new ApiError('http', { status: 409, code: 'SUPPORT_REQUIRED' });
      }),
  };
}

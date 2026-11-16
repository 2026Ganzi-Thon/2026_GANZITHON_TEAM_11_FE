import type { ClosingRequest } from '../night/closing/types';
export interface NightMorningNavigationState {
  page: 'entry' | 'feed' | 'closing' | 'paused' | 'rest' | 'morning';
  resume: 'feed' | 'closing';
  request: ClosingRequest | null;
  wasMorning: boolean;
}
/** Screen state for one in-memory journey, separate from confirmed night data. */
export function createNightMorningNavigation() {
  let state: NightMorningNavigationState = {
    page: 'entry',
    resume: 'feed',
    request: null,
    wasMorning: false,
  };
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<NightMorningNavigationState>) => {
    state = { ...state, ...patch };
    listeners.forEach((fn) => fn());
  };
  return {
    getSnapshot: () => state,
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    setPage: (page: NightMorningNavigationState['page']) => publish({ page }),
    pause: (resume: NightMorningNavigationState['resume']) =>
      publish({ page: 'paused', resume }),
    closing: (request: ClosingRequest) =>
      publish({ page: 'closing', request: { ...request } }),
    showMorning: () => publish({ page: 'morning', wasMorning: true }),
  };
}
export type NightMorningNavigation = ReturnType<
  typeof createNightMorningNavigation
>;

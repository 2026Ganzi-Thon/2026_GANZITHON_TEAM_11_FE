import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../../api/errors';
import type { FeedPosition } from '../feed/model';
import type { NightWorryResult } from '../entry';
import {
  isId,
  readReentryRoute,
  readReentrySession,
  type ReentryActions,
  type ReentryRoute,
  type ReentrySession,
} from './model';

type Job =
  | { kind: 'bootstrap' }
  | { kind: 'resume'; nightId: string; sessionId: string };
type State =
  | { kind: 'loading'; job: Job }
  | { kind: 'error'; job: Job; closed: boolean; unsupported?: boolean }
  | { kind: 'entry'; route: ReentryRoute }
  | {
      kind: 'support';
      route: ReentryRoute;
      pending: 'continue' | 'reload' | null;
      error: string | null;
    }
  | { kind: 'feed'; session: ReentrySession }
  | { kind: 'paused'; position: FeedPosition | null };
const closed = (error: unknown) =>
  error instanceof ApiError &&
  (error.code === 'SESSION_CLOSED' || error.code === 'NIGHT_CLOSED');

export function useNightReentry(actions: ReentryActions) {
  const [state, setState] = useState<State>({
    kind: 'loading',
    job: { kind: 'bootstrap' },
  });
  const active = useRef<AbortController | null>(null);
  const viewed = useRef<FeedPosition | null>(null);
  const request = useCallback(
    async (job: Job, previousSupport?: ReentryRoute) => {
      if (active.current) return;
      const controller = new AbortController();
      active.current = controller;
      const current = () =>
        active.current === controller && !controller.signal.aborted;
      let failedJob = job;
      setState(
        previousSupport
          ? {
              kind: 'support',
              route: previousSupport,
              pending: 'reload',
              error: null,
            }
          : { kind: 'loading', job },
      );
      try {
        if (job.kind === 'bootstrap') {
          const result = await actions.bootstrap(controller.signal);
          if (!current()) return;
          const route = readReentryRoute(result);
          viewed.current = null;
          if (route.next_screen !== 'NIGHT_FEED') {
            setState(
              route.next_screen === 'NIGHT_SUPPORT'
                ? { kind: 'support', route, pending: null, error: null }
                : { kind: 'entry', route },
            );
            return;
          }
          failedJob = {
            kind: 'resume',
            nightId: route.night_id!,
            sessionId: route.active_session_id!,
          };
          setState({ kind: 'loading', job: failedJob });
        }
        if (failedJob.kind !== 'resume') return;
        const result = await actions.resume(
          failedJob.sessionId,
          controller.signal,
        );
        if (!current()) return;
        setState({
          kind: 'feed',
          session: readReentrySession(
            result,
            failedJob.nightId,
            failedJob.sessionId,
          ),
        });
      } catch (error) {
        if (!current()) return;
        if (
          previousSupport &&
          failedJob.kind === 'bootstrap' &&
          !closed(error) &&
          !(error instanceof ApiError && error.code === 'REENTRY_UNSUPPORTED')
        )
          setState({
            kind: 'support',
            route: previousSupport,
            pending: null,
            error: '도움 안내를 다시 불러오지 못했어요. 다시 시도해 주세요.',
          });
        else
          setState({
            kind: 'error',
            job: failedJob,
            closed: closed(error),
            unsupported:
              error instanceof ApiError && error.code === 'REENTRY_UNSUPPORTED',
          });
      } finally {
        if (active.current === controller) active.current = null;
      }
    },
    [actions],
  );
  useEffect(() => {
    let mounted = true;
    void Promise.resolve().then(() => {
      if (mounted) void request({ kind: 'bootstrap' });
    });
    return () => {
      mounted = false;
      active.current?.abort();
      active.current = null;
    };
  }, [request]);
  const pause = useCallback(() => {
    active.current?.abort();
    active.current = null;
    setState({ kind: 'paused', position: viewed.current });
  }, []);
  const showFeed = useCallback((session: ReentrySession) => {
    setState({ kind: 'feed', session });
  }, []);
  const observe = useCallback((position: FeedPosition) => {
    viewed.current = position;
  }, []);
  const recorded = useCallback((night: NightWorryResult) => {
    const route: ReentryRoute = {
      phase: 'night',
      next_screen:
        night.status === 'needs_support'
          ? 'NIGHT_SUPPORT'
          : 'NIGHT_SHEEP_COUNT',
      night_id: night.id,
      active_session_id: null,
      support: night.support,
    };
    setState(
      night.status === 'needs_support'
        ? { kind: 'support', route, pending: null, error: null }
        : { kind: 'entry', route },
    );
  }, []);
  async function continueSupport() {
    if (state.kind !== 'support' || !state.route.support || active.current)
      return;
    const route = state.route,
      controller = new AbortController();
    active.current = controller;
    const current = () =>
      active.current === controller && !controller.signal.aborted;
    let job: Job | null = null;
    setState({ ...state, pending: 'continue', error: null });
    try {
      const result = await actions.continueSupport(
        route.night_id!,
        controller.signal,
      );
      if (!current()) return;
      if (
        !result ||
        result.id !== route.night_id ||
        (result.active_session_id !== null && !isId(result.active_session_id))
      )
        throw new ApiError('invalid-response');
      if (result.active_session_id === null) {
        setState({
          kind: 'entry',
          route: {
            ...route,
            next_screen: 'NIGHT_SHEEP_COUNT',
            active_session_id: null,
            support: null,
          },
        });
        return;
      }
      job = {
        kind: 'resume',
        nightId: route.night_id!,
        sessionId: result.active_session_id,
      };
      setState({ kind: 'loading', job });
      const session = await actions.resume(job.sessionId, controller.signal);
      if (!current()) return;
      setState({
        kind: 'feed',
        session: readReentrySession(session, job.nightId, job.sessionId),
      });
    } catch (error) {
      if (!current()) return;
      if (job || closed(error))
        setState({
          kind: 'error',
          job: job ?? { kind: 'bootstrap' },
          closed: closed(error),
        });
      else
        setState({
          kind: 'support',
          route,
          pending: null,
          error: '계속하기 응답을 확인하지 못했어요. 다시 시도해 주세요.',
        });
    } finally {
      if (active.current === controller) active.current = null;
    }
  }
  return {
    state,
    pause,
    showFeed,
    observe,
    recorded,
    continueSupport,
    reloadSupport: () =>
      state.kind === 'support' &&
      void request({ kind: 'bootstrap' }, state.route),
    refresh: () => void request({ kind: 'bootstrap' }),
    retry: () =>
      state.kind === 'error' &&
      void request(state.closed ? { kind: 'bootstrap' } : state.job),
  };
}

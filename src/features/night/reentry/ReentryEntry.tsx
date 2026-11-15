import { useMemo, useRef } from 'react';
import { ApiError } from '../../../api/errors';
import { NightEntryScreen } from '../NightEntryScreen';
import {
  readNightWorryResult,
  isSheepCountRejection,
  type NightEntryActions,
  type NightWorryResult,
} from '../entry';
import {
  readReentrySession,
  type ReentryActions,
  type ReentryRoute,
  type ReentrySession,
} from './model';

export function ReentryEntry({
  actions,
  route,
  onCreated,
  onRecorded,
  onBack,
  onCreationUnconfirmed,
  initialCount = 15,
}: {
  actions: ReentryActions;
  route: ReentryRoute;
  onCreated: (session: ReentrySession) => void;
  onRecorded: (night: NightWorryResult) => void;
  onBack: () => void;
  onCreationUnconfirmed: (nightId: string, count: number) => void;
  initialCount?: number;
}) {
  const created = useRef<ReentrySession | null>(null);
  const bridge = useMemo(() => {
    const nightId = route.night_id;
    const entry: NightEntryActions = {
      checkWorry: async (draft, signal) => {
        const result = await actions.checkWorry(draft, signal);
        if (signal.aborted) throw new ApiError('aborted');
        const night = readNightWorryResult(result);
        if (route.night_id !== null && route.night_id !== night.id)
          throw new ApiError('invalid-response');
        onRecorded(night);
        return night;
      },
      continueSupport: (id, signal) => {
        if (id !== nightId)
          return Promise.reject(new ApiError('invalid-response'));
        return actions.continueSupport(id, signal);
      },
      startCounting: async (count, signal) => {
        if (!nightId) throw new ApiError('invalid-response');
        try {
          const result = await actions.createSession(nightId, count, signal);
          if (signal.aborted) throw new ApiError('aborted');
          const session = readReentrySession(result, nightId);
          if (
            session.sheep_count !== count ||
            session.position !== 0 ||
            session.furthest_position !== 0 ||
            session.sequence !== 0
          )
            throw new ApiError('invalid-response');
          created.current = session;
        } catch (error) {
          if (!signal.aborted && !isSheepCountRejection(error))
            onCreationUnconfirmed(nightId, count);
          throw error;
        }
      },
    };
    return entry;
  }, [actions, route, onRecorded, onCreationUnconfirmed]);
  return (
    <NightEntryScreen
      actions={bridge}
      initialCount={initialCount}
      mode={
        route.next_screen === 'NIGHT_SHEEP_COUNT'
          ? 'existing-night'
          : 'first-entry'
      }
      onBack={onBack}
      onStarted={() => {
        const session = created.current;
        if (session) onCreated(session);
      }}
    />
  );
}

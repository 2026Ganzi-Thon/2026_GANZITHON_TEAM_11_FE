import { useCallback, useEffect, useRef } from 'react';
import { ApiError } from '../../../api/errors';
import { FeedScreen } from '../feed/FeedScreen';
import type { FeedPosition } from '../feed/model';
import type { ReentryActions, ReentrySession } from './model';
import { readReentryCards } from './readCards';

export function ReentryFeed({
  actions,
  session,
  onBack,
  onPosition,
}: {
  actions: ReentryActions;
  session: ReentrySession;
  onBack: () => void;
  onPosition: (value: FeedPosition) => void;
}) {
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const load = useCallback(
    async (signal: AbortSignal) => {
      const cards = await actions.loadFeed(session.id, signal);
      if (signal.aborted || !active.current) throw new ApiError('aborted');
      return readReentryCards(cards, session.sheep_count);
    },
    [actions, session],
  );
  const progress = useCallback(
    (value: FeedPosition) => {
      if (!active.current) return;
      actions.rememberPosition(session, value);
      onPosition(value);
    },
    [actions, session, onPosition],
  );
  return (
    <FeedScreen
      load={load}
      initialPosition={{
        position: session.position || 1,
        furthestPosition: session.furthest_position || 1,
      }}
      onProgress={progress}
      onBack={onBack}
    />
  );
}

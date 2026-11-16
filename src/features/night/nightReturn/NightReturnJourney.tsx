import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '../../../api/errors';
import type { createNightMorningDemo } from '../../../mocks/nightMorningDemo';
import { NightMorningFlow } from '../../demo/NightMorningFlow';
import type { NightMorningNavigation } from '../../demo/navigation';
import { NightEntryScreen } from '../NightEntryScreen';
import { isSheepCountRejection } from '../entry';
import { NightReturnFlow } from './NightReturnFlow';
import type { ReturnRoute } from './model';
interface Props {
  demo: ReturnType<typeof createNightMorningDemo>;
  navigation: NightMorningNavigation;
  blocked?: boolean;
  onHome: () => void;
  onMorning: () => void;
  onExit: () => void;
}
/** A fresh bootstrap check on every home-to-night visit; all writes belong to N02. */
export function NightReturnJourney({
  demo,
  navigation,
  blocked = false,
  onHome,
  onMorning,
  onExit,
}: Props) {
  const [page, setPage] = useState<'check' | 'count' | 'flow'>(() =>
    demo.getRecord().finished ? 'check' : 'flow',
  );
  const [count, setCount] = useState(5);
  const paused = useRef(blocked);
  useLayoutEffect(() => {
    paused.current = blocked;
  }, [blocked]);
  const navigate = useCallback(
    (route: Exclude<ReturnRoute, { kind: 'return' }>) => {
      if (
        route.kind === 'morning' ||
        route.kind === 'home' ||
        route.kind === 'support'
      ) {
        onHome();
        return;
      }
      if (route.kind === 'feed') navigation.setPage('feed');
      if (route.kind === 'closing') {
        const request = demo.getClosingRequest();
        if (!request) {
          onHome();
          return;
        }
        navigation.closing(request);
      }
      setPage('flow');
    },
    [demo, navigation, onHome],
  );
  const actions = useMemo(
    () => ({
      ...demo.entry,
      startCounting: async (value: number, signal: AbortSignal) => {
        if (paused.current) throw new ApiError('aborted');
        try {
          await demo.returning.create(value, signal);
        } catch (error) {
          if (!signal.aborted && !isSheepCountRejection(error))
            setPage('check');
          throw error;
        }
      },
    }),
    [demo],
  );
  if (page === 'check')
    return (
      <NightReturnFlow
        actions={demo.returning}
        onExit={onHome}
        onNavigate={navigate}
        onRestart={(request) => {
          setCount(request.count);
          setPage('count');
        }}
      />
    );
  if (page === 'count')
    return (
      <NightEntryScreen
        actions={actions}
        mode="existing-night"
        initialCount={count}
        onBack={() => setPage('check')}
        onStarted={() => {
          navigation.setPage('feed');
          setPage('flow');
        }}
      />
    );
  return (
    <NightMorningFlow
      demo={demo}
      navigation={navigation}
      blocked={blocked}
      entryMode={demo.getRecord().night ? 'existing-night' : 'first-entry'}
      onExit={onExit}
      onHome={onHome}
      onMorning={onMorning}
      onReturn={() => setPage('check')}
    />
  );
}

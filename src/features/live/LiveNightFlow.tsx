import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, ScrollView } from 'react-native';
import type { Bootstrap } from '../../api/contracts';
import type { ApiSession } from '../../api/session';
import type { LiveResources } from '../../api/resources';
import { createLiveNight } from '../../api/night';
import { createLiveCardWriting } from '../../api/cardWriting';
import { NightEntryScreen } from '../night/NightEntryScreen';
import { FeedScreen } from '../night/feed/FeedScreen';
import { FeedCard } from '../night/feed/FeedCard';
import type { FeedPosition } from '../night/feed/model';
import { ClosingScreen } from '../night/closing/ClosingScreen';
import type { ClosingRequest } from '../night/closing/types';
import { NightExpiryBoundary } from '../night/expiry/NightExpiryBoundary';
import { NightReturnScreen } from '../night/nightReturn/NightReturnScreen';
import { SupportContent } from '../support/SupportContent';
import { CardWritingScreen } from '../cards/CardWritingScreen';
import { NightScreen } from '../../ui/NightScreen';
import { Notice } from '../../ui/Notice';
import { Button } from '../../ui/Button';
export function LiveNightFlow({
  api,
  resources,
  bootstrap,
  onHome,
}: {
  api: ApiSession;
  resources: LiveResources;
  bootstrap: Bootstrap;
  onHome: () => void;
}) {
  const [night] = useState(() => createLiveNight(api, resources, bootstrap));
  return (
    <NightExpiryBoundary
      actions={night.expiry}
      onHome={onHome}
      onMorning={onHome}
    >
      {(blocked) => (
        <NightSession
          night={night}
          api={api}
          boot={bootstrap}
          onHome={onHome}
          blocked={blocked}
        />
      )}
    </NightExpiryBoundary>
  );
}
function NightSession({
  night,
  api,
  boot,
  onHome,
  blocked,
}: {
  night: ReturnType<typeof createLiveNight>;
  api: ApiSession;
  boot: Bootstrap;
  onHome: () => void;
  blocked: boolean;
}) {
  const [page, setPage] = useState<
    'loading' | 'entry' | 'feed' | 'closing' | 'writing' | 'support' | 'return'
  >(
    boot.active_session_id
      ? 'loading'
      : boot.next_screen === 'NIGHT_SUPPORT'
        ? 'support'
        : boot.last_session
          ? 'return'
          : 'entry',
  );
  const [error, setError] = useState(false),
    [attempt, retry] = useState(0),
    [supportBusy, setSupportBusy] = useState(false);
  const [closing, setClosing] = useState<ClosingRequest | null>(null);
  const [count, setCount] = useState(5);
  const [writing] = useState(() => createLiveCardWriting(api));
  const request = useRef<AbortController | null>(null);
  const unsaved = useRef<FeedPosition | null>(null);
  useEffect(() => {
    const c = new AbortController();
    request.current = c;
    if (page === 'loading') {
      void night
        .resume(c.signal)
        .then(() => {
          if (!c.signal.aborted) {
            setError(false);
            setPage('feed');
          }
        })
        .catch(() => {
          if (!c.signal.aborted) setError(true);
        });
    }
    return () => c.abort();
  }, [night, page, attempt]);
  const progress = useCallback(
    (value: FeedPosition) => {
      if (!request.current) return;
      const signal = request.current.signal;
      void night.progress(value, signal).catch(() => {
        if (!signal.aborted) {
          unsaved.current = value;
          setError(true);
        }
      });
    },
    [night],
  );
  const entrust = useMemo(
    () => (page === 'feed' ? night.entrust() : undefined),
    [night, page],
  );
  useEffect(() => {
    if (page !== 'support' && page !== 'loading') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onHome();
      return true;
    });
    return () => sub.remove();
  }, [page, onHome]);
  // Bootstrap supplies the pending card but not its finished session ID.
  // Keep this read-only until that ID can be used for closing-view confirmation.
  if (boot.next_screen === 'NIGHT_CLOSING' && !boot.active_session_id) {
    const card = boot.last_session?.closing_card;
    return (
      <NightScreen>
        <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
          <Notice
            title="밤의 마무리"
            description="아까 센 양들이 잘 쉬고 있어요."
          />
          {card?.available && card.content && (
            <FeedCard card={card} isLast={false} />
          )}
          <Button label="홈으로" onPress={onHome} />
        </ScrollView>
      </NightScreen>
    );
  }
  if (error || page === 'loading')
    return (
      <NightScreen>
        <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
          <Notice
            title={
              error
                ? '서버에서 밤 기록을 확인하지 못했어요'
                : '기존 양 세기를 확인하고 있어요'
            }
            description="저장이 확인되기 전에는 진행을 잠시 멈춰요."
            error={error}
          />
          {error && (
            <Button
              label="다시 확인"
              onPress={() => {
                if (!unsaved.current) {
                  setError(false);
                  retry((n) => n + 1);
                  return;
                }
                const c = new AbortController();
                request.current = c;
                void night
                  .progress(unsaved.current, c.signal)
                  .then(() => {
                    unsaved.current = null;
                    setError(false);
                  })
                  .catch(() => {});
              }}
            />
          )}
          <Button label="홈으로" onPress={onHome} />
        </ScrollView>
      </NightScreen>
    );
  if (page === 'support')
    return (
      <NightScreen>
        <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
          {boot.support && (
            <SupportContent support={boot.support} onReturn={onHome} />
          )}
          <Button
            label="계속 양 세기"
            busy={supportBusy}
            disabled={blocked}
            onPress={() => {
              setSupportBusy(true);
              const c = new AbortController();
              request.current = c;
              void night.entry
                .continueSupport(boot.night_id!, c.signal)
                .then(() => {
                  if (!c.signal.aborted) setPage('entry');
                })
                .catch(() => {
                  if (!c.signal.aborted) setError(true);
                })
                .finally(() => setSupportBusy(false));
            }}
          />
          <Button label="홈으로" onPress={onHome} />
        </ScrollView>
      </NightScreen>
    );
  if (page === 'return' && boot.last_session && boot.night_id)
    return (
      <NightReturnScreen
        record={{ nightId: boot.night_id, summary: boot.last_session }}
        onRestart={(value) => {
          setCount(value);
          setPage('entry');
        }}
        onRest={onHome}
      />
    );
  if (page === 'writing')
    return (
      <CardWritingScreen
        actions={writing}
        sourceNightId={night.nightId()!}
        onBack={onHome}
        onDone={onHome}
      />
    );
  if (page === 'closing' && closing)
    return (
      <ClosingScreen
        input={closing}
        actions={night.closing}
        onExit={onHome}
        onRest={onHome}
        onWrite={() => setPage('writing')}
        blocked={blocked}
      />
    );
  if (page === 'feed')
    return (
      <FeedScreen
        load={night.loadFeed}
        initialPosition={night.initialPosition()}
        onProgress={progress}
        onBack={onHome}
        onFinish={(value) => {
          setClosing(value);
          setPage('closing');
        }}
        songs={night.songs}
        yarn={night.yarn}
        fluff={night.fluff}
        entrust={entrust}
        stopOffer={night.stopOffer()}
        blocked={blocked}
      />
    );
  return (
    <NightEntryScreen
      actions={night.entry}
      mode={night.nightId() ? 'existing-night' : 'first-entry'}
      worryLimit={500}
      initialCount={count}
      onBack={onHome}
      onStarted={() => setPage('feed')}
    />
  );
}

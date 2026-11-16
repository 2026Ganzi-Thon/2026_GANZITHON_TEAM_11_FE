import { CardWritingScreen } from '../cards/CardWritingScreen';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import {
  createNightMorningNavigation,
  type NightMorningNavigation,
} from './navigation';
import { BackHandler, ScrollView, StyleSheet } from 'react-native';
import { NightEntryScreen } from '../night/NightEntryScreen';
import { FeedScreen } from '../night/feed/FeedScreen';
import { ClosingScreen } from '../night/closing/ClosingScreen';
import { MorningScreen } from '../morning/MorningScreen';
import { NightScreen } from '../../ui/NightScreen';
import { Notice } from '../../ui/Notice';
import { Button } from '../../ui/Button';
import type { createNightMorningDemo } from '../../mocks/nightMorningDemo';
export function NightMorningFlow(props: NightMorningFlowProps) {
  const [source, setSource] = useState({
    demo: props.demo,
    navigation: props.navigation,
    version: 0,
  });
  if (source.demo !== props.demo || source.navigation !== props.navigation)
    setSource({
      demo: props.demo,
      navigation: props.navigation,
      version: source.version + 1,
    });
  return <NightMorningSession key={source.version} {...props} />;
}
interface NightMorningFlowProps {
  demo: ReturnType<typeof createNightMorningDemo>;
  onExit: () => void;
  initialCount?: number;
  navigation?: NightMorningNavigation;
  onHome?: () => void;
  onMorning?: () => void;
  entryMode?: 'first-entry' | 'existing-night';
  blocked?: boolean;
}
function NightMorningSession({
  demo,
  onExit,
  initialCount = 3,
  navigation,
  onHome,
  onMorning,
  entryMode,
  blocked = false,
}: NightMorningFlowProps) {
  const [writingOpen, setWritingOpen] = useState(false);
  const openWriting = useCallback(() => setWritingOpen(true), []);
  const [nav] = useState(() => navigation ?? createNightMorningNavigation());
  const { page, resume, request, wasMorning } = useSyncExternalStore(
    nav.subscribe,
    nav.getSnapshot,
    nav.getSnapshot,
  );
  const setPage = nav.setPage;
  useEffect(() => {
    if (page !== 'paused' && page !== 'rest') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (onHome) onHome();
      else if (page === 'paused') setPage(resume);
      else onExit();
      return true;
    });
    return () => sub.remove();
  }, [page, resume, onExit, onHome, setPage]);
  const pause = nav.pause;
  if (page === 'entry')
    return (
      <NightEntryScreen
        actions={demo.entry}
        onBack={onHome ?? onExit}
        mode={entryMode}
        initialCount={initialCount}
        onStarted={() => setPage('feed')}
      />
    );
  if (page === 'feed')
    return (
      <FeedScreen
        load={demo.loadFeed}
        entrust={demo.entrust}
        songs={demo.songs}
        yarn={demo.yarn}
        fluff={demo.fluff}
        initialPosition={demo.getProgress()}
        onProgress={demo.progress}
        onFinish={nav.closing}
        onBack={() => pause('feed')}
      />
    );
  if (page === 'closing' && request)
    return (
      <>
        <ClosingScreen
          input={request}
          actions={demo.closing}
          onExit={() => pause('closing')}
          onRest={() => setPage('rest')}
          onWrite={openWriting}
        />
        {writingOpen && !blocked && (
          <CardWritingScreen
            modal
            actions={demo.cardWriting}
            sourceNightId={demo.nightId}
            onBack={() => setWritingOpen(false)}
            onDone={() => {
              setWritingOpen(false);
              setPage('rest');
            }}
          />
        )}
      </>
    );
  if (page === 'morning')
    return (
      <MorningScreen
        actions={demo.morning}
        loadDetail={demo.morning.loadSheep}
        onExit={() => setPage('rest')}
      />
    );
  return (
    <NightScreen>
      <ScrollView contentContainerStyle={styles.content}>
        <Notice
          title={
            page === 'paused'
              ? '시연을 잠깐 멈췄어요'
              : '밤 마무리를 확인했어요'
          }
          description={
            page === 'paused'
              ? '선택한 수와 마지막으로 본 위치를 유지해요. 이어 보거나 시연을 끝낼 수 있어요.'
              : '개발용 시연에서만 다음 아침으로 이동해요. 실제 시간 판정·서버 저장과 연결되지 않아요.'
          }
        />
        {page === 'paused' ? (
          <Button label="이어 보기" onPress={() => setPage(resume)} />
        ) : (
          <Button
            label={wasMorning ? '아침 다시 보기' : '다음 아침으로 이동'}
            onPress={() => {
              demo.advanceMorning();
              nav.showMorning();
              onMorning?.();
            }}
          />
        )}
        <Button
          label={onHome ? '홈으로 돌아가기' : '시연 끝내기'}
          onPress={onHome ?? onExit}
        />
      </ScrollView>
    </NightScreen>
  );
}
const styles = StyleSheet.create({
  content: { padding: 20, gap: 24, flexGrow: 1, justifyContent: 'center' },
});

import { TextCardScreen } from '../cards/TextCardScreen';
import { useCallback, useEffect, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet } from 'react-native';
import { NightEntryScreen } from '../night/NightEntryScreen';
import { FeedScreen } from '../night/feed/FeedScreen';
import { ClosingScreen } from '../night/closing/ClosingScreen';
import type { ClosingRequest } from '../night/closing/types';
import { MorningScreen } from '../morning/MorningScreen';
import { NightScreen } from '../../ui/NightScreen';
import { Notice } from '../../ui/Notice';
import { Button } from '../../ui/Button';
import type { createNightMorningDemo } from '../../mocks/nightMorningDemo';
type Page = 'entry' | 'feed' | 'closing' | 'paused' | 'rest' | 'morning';
export function NightMorningFlow({
  demo,
  onExit,
  initialCount = 3,
}: {
  demo: ReturnType<typeof createNightMorningDemo>;
  onExit: () => void;
  initialCount?: number;
}) {
  const [writingOpen, setWritingOpen] = useState(false);
  const openWriting = useCallback(() => setWritingOpen(true), []);
  const [page, setPage] = useState<Page>('entry');
  const [resume, setResume] = useState<'feed' | 'closing'>('feed');
  const [request, setRequest] = useState<ClosingRequest | null>(null);
  const [wasMorning, setWasMorning] = useState(false);
  useEffect(() => {
    if (page !== 'paused' && page !== 'rest') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (page === 'paused') setPage(resume);
      else onExit();
      return true;
    });
    return () => sub.remove();
  }, [page, resume, onExit]);
  const pause = (from: 'feed' | 'closing') => {
    setResume(from);
    setPage('paused');
  };
  if (page === 'entry')
    return (
      <NightEntryScreen
        actions={demo.entry}
        onBack={onExit}
        initialCount={initialCount}
        onStarted={() => setPage('feed')}
      />
    );
  if (page === 'feed')
    return (
      <FeedScreen
        load={demo.loadFeed}
        songs={demo.songs}
        yarn={demo.yarn}
        initialPosition={demo.getProgress()}
        onProgress={demo.progress}
        onFinish={(input) => {
          setRequest(input);
          setPage('closing');
        }}
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
        {writingOpen && (
          <TextCardScreen
            modal
            actions={demo.textCards}
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
              setWasMorning(true);
              setPage('morning');
            }}
          />
        )}
        <Button label="시연 끝내기" onPress={onExit} />
      </ScrollView>
    </NightScreen>
  );
}
const styles = StyleSheet.create({
  content: { padding: 20, gap: 24, flexGrow: 1, justifyContent: 'center' },
});

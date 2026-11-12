import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentRef,
} from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { Card } from '../../../api/contracts';
import { Button } from '../../../ui/Button';
import { NightScreen } from '../../../ui/NightScreen';
import { Notice } from '../../../ui/Notice';
import { theme } from '../../../ui/theme';
import { FeedCard } from './FeedCard';
import { movePosition, type FeedLoad, type FeedPosition } from './model';
import { SheepStage } from './SheepStage';
import { useFeedMotion } from './useFeedMotion';

export function FeedScreen({
  load,
  onBack,
}: {
  load: FeedLoad;
  onBack: () => void;
}) {
  const [response, setResponse] = useState<{
    source: FeedLoad;
    attempt: number;
    cards: Card[];
    error: boolean;
  } | null>(null);
  const [done, setDone] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const matches = response?.source === load && response.attempt === attempt;
  const cards = matches ? response.cards : [];
  const status = !matches
    ? 'loading'
    : response.error
      ? 'error'
      : done
        ? 'done'
        : 'ready';
  const [position, setPosition] = useState<FeedPosition>({
    position: 1,
    furthestPosition: 1,
  });
  const current = useRef(position);
  const controller = useRef<AbortController | null>(null);
  const body = useRef<ComponentRef<typeof ScrollView>>(null);
  const { progress, direction, moving, run, cancel } = useFeedMotion();
  useEffect(() => {
    const request = new AbortController();
    controller.current = request;
    cancel();
    void (async () => {
      try {
        const result = await load(request.signal);
        if (request.signal.aborted) return;
        setResponse({ source: load, attempt, cards: result, error: false });
        current.current = { position: 1, furthestPosition: 1 };
        setPosition(current.current);
        setDone(false);
      } catch {
        if (!request.signal.aborted)
          setResponse({ source: load, attempt, cards: [], error: true });
      }
    })();
    return () => {
      request.abort();
      cancel();
    };
  }, [load, attempt, cancel]);
  const back = useCallback(() => {
    controller.current?.abort();
    cancel();
    onBack();
  }, [cancel, onBack]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        back();
        return true;
      },
    );
    return () => subscription.remove();
  }, [back]);
  const move = useCallback(
    (delta: -1 | 1) => {
      if (status !== 'ready' || !cards.length) return;
      const next = movePosition(current.current, delta, cards.length);
      if (next.position === current.current.position) return;
      run(delta, () => {
        current.current = next;
        setPosition(next);
        body.current?.scrollTo({ y: 0, animated: false });
      });
    },
    [cards.length, run, status],
  );
  const card = cards[position.position - 1];
  return (
    <NightScreen>
      <View style={styles.topbar}>
        <View>
          <Text
            accessibilityLabel="양 세기 진행"
            accessibilityLiveRegion="polite"
            style={styles.progress}
          >
            {status === 'ready' && card
              ? `${position.position} / ${cards.length}`
              : '양 세는 밤'}
          </Text>
          <Text style={styles.preview}>미리보기 · 저장 안 함</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="미리보기 나가기"
          onPress={back}
          style={styles.exit}
        >
          <Text style={styles.exitLabel}>미리보기 나가기</Text>
        </Pressable>
      </View>
      {status === 'loading' ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.color.primary} />
          <Text style={styles.message}>카드를 불러오고 있어요</Text>
        </View>
      ) : status === 'error' || (status === 'ready' && !card) ? (
        <View style={styles.center}>
          <Notice
            title={
              status === 'error'
                ? '카드를 불러오지 못했어요'
                : '표시할 카드가 없어요'
            }
            description={
              status === 'error'
                ? '잠시 후 다시 시도해 주세요.'
                : '미리보기를 다시 열어 확인해 주세요.'
            }
            error={status === 'error'}
          />
          <Button
            label="다시 시도"
            onPress={() => setAttempt((value) => value + 1)}
          />
        </View>
      ) : status === 'done' ? (
        <View style={styles.center}>
          <Notice
            title="피드 미리보기를 마쳤어요"
            description={`${cards.length}장의 예시 카드를 확인했어요. 실제 진행·종료 기록은 저장하지 않았어요.`}
          />
          <Button label="미리보기로 돌아가기" onPress={back} />
        </View>
      ) : (
        <>
          <ScrollView ref={body} contentContainerStyle={styles.content}>
            <SheepStage
              progress={progress}
              direction={direction}
              onMove={move}
            />
            <Text style={styles.hint}>양 위에서 위·아래로 넘겨요</Text>
            <FeedCard
              key={card.id}
              card={card}
              isLast={position.position === cards.length}
            />
          </ScrollView>
          <View style={styles.navigation}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="이전 양"
              disabled={moving || position.position === 1}
              accessibilityState={{
                disabled: moving || position.position === 1,
              }}
              onPress={() => move(-1)}
              style={[
                styles.previous,
                (moving || position.position === 1) && styles.disabled,
              ]}
            >
              <Text style={styles.previousLabel}>← 이전 양</Text>
            </Pressable>
            <View style={styles.next}>
              <Button
                label={
                  position.position === cards.length
                    ? '미리보기 마치기'
                    : '다음 양'
                }
                disabled={moving}
                onPress={() => {
                  if (position.position === cards.length) setDone(true);
                  else move(1);
                }}
              />
            </View>
          </View>
        </>
      )}
    </NightScreen>
  );
}
const styles = StyleSheet.create({
  topbar: {
    minHeight: 64,
    paddingHorizontal: 20,
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progress: {
    fontFamily: theme.font,
    fontWeight: '700',
    fontSize: 15,
    lineHeight: 22,
    color: theme.color.text,
  },
  preview: {
    fontFamily: theme.font,
    fontSize: 10,
    lineHeight: 16,
    color: theme.color.muted,
  },
  exit: { minHeight: 48, justifyContent: 'center', paddingLeft: 12 },
  exitLabel: {
    fontFamily: theme.font,
    fontSize: 12,
    lineHeight: 18,
    color: theme.color.muted,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 14,
    paddingTop: 6,
    alignItems: 'center',
  },
  hint: {
    fontFamily: theme.font,
    fontSize: 10,
    lineHeight: 16,
    color: theme.color.muted,
    marginBottom: 14,
  },
  navigation: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  previous: {
    flex: 1,
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#4A5BC2',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E2063',
  },
  previousLabel: {
    fontFamily: theme.font,
    fontWeight: '700',
    fontSize: 15,
    lineHeight: 22,
    includeFontPadding: false,
    color: theme.color.text,
  },
  disabled: { opacity: 0.4 },
  next: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', padding: 20, gap: 20 },
  message: {
    fontFamily: theme.font,
    fontSize: 15,
    lineHeight: 24,
    color: theme.color.text,
    textAlign: 'center',
  },
});

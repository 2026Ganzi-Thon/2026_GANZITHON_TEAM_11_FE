import { YarnFeedback } from '../../yarn/YarnFeedback';
import { FluffFeedback } from '../../fluff/FluffFeedback';
import { useFluffBookmarks } from '../../fluff/useFluffBookmarks';
import type { FluffActions } from '../../fluff/types';
import type { YarnActions } from '../../yarn/types';
import { useYarnReactions } from '../../yarn/useYarnReactions';
import { SongSaveButton } from '../../songs/SongSaveButton';
import type { SongActions } from '../../songs/types';
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
import { ClosingScreen } from '../closing/ClosingScreen';
import type { ClosingActions, ClosingRequest } from '../closing/types';
import { movePosition, type FeedLoad, type FeedPosition } from './model';
import { SheepStage } from './SheepStage';
import { useFeedMotion } from './useFeedMotion';

export function FeedScreen({
  load,
  onBack,
  closingActions,
  initialPosition,
  onProgress,
  onFinish,
  songs,
  yarn,
  fluff,
}: {
  load: FeedLoad;
  onBack: () => void;
  closingActions?: ClosingActions;
  initialPosition?: FeedPosition;
  onProgress?: (position: FeedPosition) => void;
  onFinish?: (request: ClosingRequest) => void;
  songs?: SongActions;
  yarn?: YarnActions;
  fluff?: FluffActions;
}) {
  const [start] = useState(
    () => initialPosition ?? { position: 1, furthestPosition: 1 },
  );
  const [response, setResponse] = useState<{
    source: FeedLoad;
    attempt: number;
    cards: Card[];
    error: boolean;
  } | null>(null);
  const [songPending, setSongPending] = useState(false);
  const songPendingRef = useRef(false);
  const onSongPendingChange = useCallback((pending: boolean) => {
    songPendingRef.current = pending;
    setSongPending(pending);
  }, []);
  const [done, setDone] = useState(false);
  const [closingRequest, setClosingRequest] = useState<ClosingRequest | null>(
    null,
  );
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
  const yarnFlow = useYarnReactions(
    yarn,
    load,
    status === 'ready' && !closingRequest,
  );
  const { stop: stopYarn } = yarnFlow;
  const fluffFlow = useFluffBookmarks(
    fluff,
    load,
    status === 'ready' && !closingRequest,
  );
  const { stop: stopFluff } = fluffFlow;
  const fluffPending = fluffFlow.hasPending();
  const [feedback, setFeedback] = useState<{
    cardId: string;
    kind: 'yarn' | 'fluff';
  } | null>(null);
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
        current.current = {
          position: Math.max(1, Math.min(start.position, result.length)),
          furthestPosition: Math.max(
            1,
            Math.min(start.furthestPosition, result.length),
          ),
        };
        if (result.length) onProgress?.(current.current);
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
  }, [load, attempt, cancel, start, onProgress]);
  const back = useCallback(() => {
    controller.current?.abort();
    cancel();
    stopYarn();
    stopFluff();
    onBack();
  }, [cancel, onBack, stopYarn, stopFluff]);
  useEffect(() => {
    if (closingRequest) return;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        back();
        return true;
      },
    );
    return () => subscription.remove();
  }, [back, closingRequest]);
  const move = useCallback(
    (delta: -1 | 1) => {
      if (songPendingRef.current || status !== 'ready' || !cards.length) return;
      const next = movePosition(current.current, delta, cards.length);
      if (next.position === current.current.position) return;
      run(delta, () => {
        current.current = next;
        setPosition(next);
        onProgress?.(next);
        body.current?.scrollTo({ y: 0, animated: false });
      });
    },
    [cards.length, run, status, onProgress],
  );
  const card = cards[position.position - 1];
  const yarnState = card ? yarnFlow.stateFor(card) : null;
  const fluffState = card ? fluffFlow.stateFor(card) : null;
  const visibleCard =
    card &&
    (yarnState?.error === 'unavailable' || fluffState?.error === 'unavailable')
      ? { ...card, available: false, content: null }
      : card;
  const finish = (reason: ClosingRequest['reason']) => {
    if (
      moving ||
      fluffFlow.hasPending() ||
      (reason === 'completed' && songPendingRef.current) ||
      status !== 'ready' ||
      !card ||
      closingRequest
    )
      return;
    cancel();
    stopYarn();
    stopFluff();
    if (onFinish)
      onFinish({ reason, ...current.current, sheepCount: cards.length });
    else if (closingActions)
      setClosingRequest({
        reason,
        ...current.current,
        sheepCount: cards.length,
      });
    else setDone(true);
  };
  if (closingRequest && closingActions)
    return (
      <ClosingScreen
        input={closingRequest}
        actions={closingActions}
        onExit={back}
      />
    );
  const canFinish =
    !!(closingActions || onFinish) && status === 'ready' && !!card;
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
          accessibilityLabel={
            canFinish ? '그만 세고 싶어요' : '미리보기 나가기'
          }
          accessibilityHint={
            fluffPending
              ? canFinish
                ? '솜털 변경을 확인한 뒤 밤을 마칠 수 있어요.'
                : '나가면 남은 솜털 요청을 취소해요.'
              : undefined
          }
          disabled={canFinish && (moving || fluffPending)}
          accessibilityState={{
            disabled: canFinish && (moving || fluffPending),
          }}
          onPress={canFinish ? () => finish('leave') : back}
          style={styles.exit}
        >
          <Text style={styles.exitLabel}>
            {canFinish ? '그만 세고 싶어요' : '미리보기 나가기'}
          </Text>
          {fluffPending && (
            <Text style={styles.preview} accessibilityLiveRegion="polite">
              솜털 확인 중
            </Text>
          )}
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
          <View style={styles.feedViewport}>
            <ScrollView
              ref={body}
              style={styles.feedScroll}
              contentContainerStyle={styles.content}
            >
              <SheepStage
                progress={progress}
                direction={direction}
                onMove={move}
              />
              <Text style={styles.hint}>양 위에서 위·아래로 넘겨요</Text>
              <FeedCard
                key={card.id}
                card={visibleCard}
                yarn={
                  yarn && yarnState
                    ? {
                        state: yarnState,
                        onToggle: () => {
                          setFeedback({ cardId: card.id, kind: 'yarn' });
                          yarnFlow.toggle(card);
                        },
                      }
                    : undefined
                }
                fluff={
                  fluff && fluffState
                    ? {
                        state: fluffState,
                        onToggle: () => {
                          setFeedback({ cardId: card.id, kind: 'fluff' });
                          fluffFlow.toggle(card);
                        },
                      }
                    : undefined
                }
                isLast={position.position === cards.length}
              />
              {fluffState?.error === 'failed' && (
                <View
                  style={styles.yarnStatus}
                  onLayout={(event) =>
                    body.current?.scrollTo({
                      y: event.nativeEvent.layout.y,
                      animated: false,
                    })
                  }
                >
                  <Notice
                    error
                    title="솜털 변경을 확인하지 못했어요"
                    description={
                      fluffState.target
                        ? '붙이기를 확인하지 못했어요. 마지막으로 확인한 표시를 유지해요.'
                        : '떼기를 확인하지 못했어요. 마지막으로 확인한 표시를 유지해요.'
                    }
                  />
                  <Button
                    label="솜털 다시 시도"
                    onPress={() => {
                      setFeedback({ cardId: card.id, kind: 'fluff' });
                      fluffFlow.retry(card);
                    }}
                  />
                </View>
              )}
              {fluffState?.pending && (
                <View style={styles.yarnStatus}>
                  <Text style={styles.message}>
                    다른 양은 볼 수 있어요. 밤 마무리는 솜털 확인 후 가능하며,
                    뒤로 나가면 남은 요청을 취소해요.
                  </Text>
                </View>
              )}
              {yarnState?.error === 'failed' && (
                <View
                  style={styles.yarnStatus}
                  onLayout={(event) =>
                    body.current?.scrollTo({
                      y: event.nativeEvent.layout.y,
                      animated: false,
                    })
                  }
                >
                  <Notice
                    error
                    title="털실 변경을 확인하지 못했어요"
                    description={
                      yarnState.target
                        ? '선택한 보내기를 확인하지 못했어요. 확인된 마지막 상태를 표시해요.'
                        : '선택한 취소를 확인하지 못했어요. 확인된 마지막 상태를 표시해요.'
                    }
                  />
                  <Button
                    label="털실 다시 시도"
                    onPress={() => {
                      setFeedback({ cardId: card.id, kind: 'yarn' });
                      yarnFlow.retry(card);
                    }}
                  />
                </View>
              )}
              {yarnState?.pending && (
                <View style={styles.yarnStatus}>
                  <Text style={styles.message} accessibilityLiveRegion="polite">
                    {yarnState.target
                      ? '털실을 보내는 중이에요.'
                      : '털실을 거두는 중이에요.'}{' '}
                    다른 양을 보는 동안에도 처리를 계속해요. 피드를 나가거나
                    마치면 남은 요청을 취소해요.
                  </Text>
                </View>
              )}
              {songs &&
                card.kind === 'song' &&
                visibleCard.available &&
                visibleCard.content && (
                  <SongSaveButton
                    cardId={card.id}
                    saved={card.viewer.song_saved}
                    actions={songs}
                    disabled={moving}
                    onPendingChange={onSongPendingChange}
                  />
                )}
            </ScrollView>
            {feedback?.cardId === card.id &&
              feedback.kind === 'fluff' &&
              fluffState?.notice &&
              visibleCard.available &&
              visibleCard.content && (
                <View style={styles.yarnFeedback} pointerEvents="none">
                  <FluffFeedback saved={fluffState.notice === 'saved'} />
                </View>
              )}
            {feedback?.cardId === card.id &&
              feedback.kind === 'yarn' &&
              yarnState?.notice &&
              visibleCard.available &&
              visibleCard.content && (
                <View style={styles.yarnFeedback} pointerEvents="none">
                  <YarnFeedback
                    sent={yarnState.notice === 'sent'}
                    user={card.author_type === 'user'}
                  />
                </View>
              )}
          </View>
          {fluffFlow.isClosed() && (
            <View style={styles.fluffStatus}>
              <Text
                style={styles.fluffMessage}
                accessibilityLiveRegion="polite"
              >
                솜털을 바꿀 수 없는 밤이에요
              </Text>
              <Text style={styles.fluffMessage}>
                마지막으로 확인한 표시를 유지했어요.
              </Text>
            </View>
          )}
          <View style={styles.navigation}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="이전 양"
              disabled={moving || songPending || position.position === 1}
              accessibilityState={{
                disabled: moving || songPending || position.position === 1,
              }}
              onPress={() => move(-1)}
              style={[
                styles.previous,
                (moving || songPending || position.position === 1) &&
                  styles.disabled,
              ]}
            >
              <Text style={styles.previousLabel}>← 이전 양</Text>
            </Pressable>
            <View style={styles.next}>
              <Button
                label={
                  position.position === cards.length
                    ? closingActions || onFinish
                      ? '마무리하기'
                      : '미리보기 마치기'
                    : '다음 양'
                }
                disabled={
                  moving ||
                  songPending ||
                  (position.position === cards.length && fluffPending)
                }
                onPress={() => {
                  if (position.position === cards.length) finish('completed');
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
  fluffStatus: {
    paddingHorizontal: 20,
    paddingVertical: 6,
    backgroundColor: theme.color.background,
  },
  fluffMessage: {
    fontFamily: theme.font,
    color: theme.color.text,
    fontSize: 11,
    lineHeight: 18,
  },
  feedViewport: { flex: 1 },
  feedScroll: { flex: 1 },
  yarnFeedback: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yarnStatus: {
    alignSelf: 'stretch',
    padding: 12,
    gap: 12,
    backgroundColor: theme.color.panel,
    marginTop: 14,
  },
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

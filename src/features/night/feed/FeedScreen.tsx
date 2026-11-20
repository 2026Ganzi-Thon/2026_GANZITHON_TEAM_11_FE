import { useLiveService } from '../../live/ServiceMode';
import { YarnFeedback } from '../../yarn/YarnFeedback';
import { FluffFeedback } from '../../fluff/FluffFeedback';
import { useFluffBookmarks } from '../../fluff/useFluffBookmarks';
import type { FluffActions } from '../../fluff/types';
import type { YarnActions } from '../../yarn/types';
import { useYarnReactions } from '../../yarn/useYarnReactions';
import { SongSaveButton } from '../../songs/SongSaveButton';
import { CardSwipeArea } from './CardSwipeArea';
import type { SongActions } from '../../songs/types';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
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
  useWindowDimensions,
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
import type { EntrustActions } from '../entrust/types';
import { useEntrustPause } from '../entrust/useEntrustPause';
import { EntrustPanel } from '../entrust/EntrustPanel';
import { StopOfferPanel } from '../stopOffer/StopOfferScreen';
import type { StopOfferItem } from '../stopOffer/model';

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
  entrust,
  stopOffer,
  blocked = false,
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
  entrust?: EntrustActions;
  stopOffer?: StopOfferItem;
  blocked?: boolean;
}) {
  const live = useLiveService();
  const { fontScale } = useWindowDimensions();
  const [viewportHeight, setViewportHeight] = useState(0),
    [contentHeight, setContentHeight] = useState(0);
  const [cardScroll, setCardScroll] = useState<{
    id: string;
    scrollable: boolean;
  } | null>(null);
  const scrollMetrics = useRef({ height: 0, content: 0, y: 0 });
  const canSwipeCard = useCallback((delta: -1 | 1) => {
    const m = scrollMetrics.current;
    if (m.height <= 0) return false;
    const max = Math.max(0, m.content - m.height);
    return max <= 1 || (delta === 1 ? m.y >= max - 2 : m.y <= 2);
  }, []);
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
  const isEntrust = entrust?.item.position === position.position;
  const isStopOffer = stopOffer?.position === position.position;
  const pauseFlow = useEntrustPause(entrust, blocked);
  const { stop: stopPause, isBusy: pauseBusy, acknowledge } = pauseFlow;
  const controller = useRef<AbortController | null>(null);
  const body = useRef<ComponentRef<typeof ScrollView>>(null);
  const { progress, direction, moving, run, cancel } = useFeedMotion();
  useLayoutEffect(() => {
    if (blocked) {
      cancel();
      acknowledge();
    }
  }, [blocked, cancel, acknowledge]);
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
    stopPause();
    onBack();
  }, [cancel, onBack, stopYarn, stopFluff, stopPause]);
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
      if (
        blocked ||
        songPendingRef.current ||
        status !== 'ready' ||
        !cards.length
      )
        return;
      if (isEntrust && (pauseBusy() || (delta === 1 && !pauseFlow.action)))
        return;
      const next = movePosition(current.current, delta, cards.length);
      if (next.position === current.current.position) return;
      if (isEntrust) acknowledge();
      run(delta, () => {
        current.current = next;
        setPosition(next);
        onProgress?.(next);
        body.current?.scrollTo({ y: 0, animated: false });
      });
    },
    [
      cards.length,
      run,
      status,
      onProgress,
      isEntrust,
      pauseBusy,
      pauseFlow.action,
      acknowledge,
      blocked,
    ],
  );
  useEffect(() => {
    if (blocked || !isEntrust || !pauseFlow.justSaved) return;
    const timer = setTimeout(() => move(1), 1600);
    return () => clearTimeout(timer);
  }, [blocked, isEntrust, pauseFlow.justSaved, move]);
  useEffect(() => {
    if (isEntrust) body.current?.scrollTo({ y: 0, animated: false });
  }, [isEntrust, pauseFlow.phase, pauseFlow.action]);
  const card = cards[position.position - 1];
  const onCardScrollableChange = useCallback(
    (scrollable: boolean) => {
      if (!card) return;
      setCardScroll((previous) =>
        previous?.id === card.id && previous.scrollable === scrollable
          ? previous
          : { id: card.id, scrollable },
      );
    },
    [card],
  );
  const yarnState = card ? yarnFlow.stateFor(card) : null;
  const fluffState = card ? fluffFlow.stateFor(card) : null;
  const isCardAvailable = (target: Card) =>
    target.available &&
    !!target.content &&
    yarnFlow.stateFor(target).error !== 'unavailable' &&
    fluffFlow.stateFor(target).error !== 'unavailable';
  const visibleCard =
    card && (isEntrust || isStopOffer || !isCardAvailable(card))
      ? { ...card, available: false, content: null }
      : card;
  const reactionsVisible = !!visibleCard?.available && !!visibleCard.content;
  const finish = (reason: ClosingRequest['reason']) => {
    if (
      blocked ||
      moving ||
      (isEntrust && pauseBusy()) ||
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
        blocked={blocked}
        onExit={back}
      />
    );
  const compactSong =
    card?.kind === 'song' &&
    fontScale <= 1.3 &&
    viewportHeight > 0 &&
    viewportHeight < 524;
  const canFinish =
    !!(closingActions || onFinish) && status === 'ready' && !!card;
  return (
    <NightScreen
      background={
        isStopOffer
          ? require('../../../../assets/images/stop-offer/background.svg')
          : isEntrust
            ? require('../../../../assets/images/entrust/background.svg')
            : undefined
      }
    >
      <View style={[styles.topbar, fontScale > 1.3 && styles.expandedTopbar]}>
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
          {!live && <Text style={styles.preview}>미리보기 · 저장 안 함</Text>}
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
          disabled={
            blocked ||
            (canFinish &&
              (moving || fluffPending || (isEntrust && pauseFlow.busy)))
          }
          accessibilityState={{
            disabled:
              blocked ||
              (canFinish &&
                (moving || fluffPending || (isEntrust && pauseFlow.busy))),
          }}
          onPress={
            canFinish
              ? () => finish(isStopOffer ? 'stop_pause' : 'leave')
              : back
          }
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
              testID="feed-scroll"
              ref={body}
              onLayout={(event) => {
                const h = event.nativeEvent.layout.height;
                setViewportHeight(h);
                scrollMetrics.current.height = h;
              }}
              onContentSizeChange={(_w, h) => {
                setContentHeight(h);
                scrollMetrics.current.content = h;
              }}
              onScroll={(event) => {
                scrollMetrics.current.y = event.nativeEvent.contentOffset.y;
              }}
              scrollEventThrottle={16}
              scrollEnabled={
                fontScale > 1.3 || contentHeight > viewportHeight + 1
              }
              style={styles.feedScroll}
              contentContainerStyle={styles.content}
            >
              {isStopOffer ? (
                <StopOfferPanel
                  onStop={() => finish('stop_pause')}
                  onContinue={() => move(1)}
                  disabled={
                    blocked ||
                    moving ||
                    songPending ||
                    fluffPending ||
                    !canFinish
                  }
                />
              ) : isEntrust && entrust ? (
                <EntrustPanel
                  worry={entrust.item.worry_text}
                  flow={pauseFlow}
                  disabled={moving || blocked}
                />
              ) : (
                <>
                  <SheepStage
                    scale={compactSong ? 0.5 : 1}
                    progress={progress}
                    direction={direction}
                    onMove={move}
                  />
                  {!live && (
                    <Text style={styles.hint}>
                      {fontScale > 1.3 || cardScroll?.scrollable
                        ? '본문은 스크롤하고 양 위에서 넘겨요'
                        : '카드나 양을 위·아래로 넘겨요'}
                    </Text>
                  )}
                  <CardSwipeArea
                    onMove={move}
                    canMove={canSwipeCard}
                    disabled={
                      fontScale > 1.3 ||
                      cardScroll?.id !== card.id ||
                      cardScroll.scrollable
                    }
                  >
                    <FeedCard
                      onScrollableChange={onCardScrollableChange}
                      songHeight={
                        viewportHeight > 0
                          ? Math.max(
                              200,
                              Math.min(
                                340,
                                viewportHeight - (compactSong ? 189 : 244),
                              ),
                            )
                          : 340
                      }
                      key={card.id}
                      card={visibleCard}
                      yarn={
                        yarn && yarnState
                          ? {
                              state: yarnState,
                              onToggle: () => {
                                if (!isCardAvailable(card)) return;
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
                                if (!isCardAvailable(card)) return;
                                setFeedback({ cardId: card.id, kind: 'fluff' });
                                fluffFlow.toggle(card);
                              },
                            }
                          : undefined
                      }
                      isLast={position.position === cards.length}
                    />
                  </CardSwipeArea>
                </>
              )}
              {reactionsVisible && fluffState?.error === 'failed' && (
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
                      if (!isCardAvailable(card)) return;
                      setFeedback({ cardId: card.id, kind: 'fluff' });
                      fluffFlow.retry(card);
                    }}
                  />
                </View>
              )}
              {reactionsVisible && yarnState?.error === 'failed' && (
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
                      if (!isCardAvailable(card)) return;
                      setFeedback({ cardId: card.id, kind: 'yarn' });
                      yarnFlow.retry(card);
                    }}
                  />
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
              disabled={
                blocked ||
                moving ||
                songPending ||
                position.position === 1 ||
                (isEntrust && pauseFlow.busy)
              }
              accessibilityState={{
                disabled:
                  blocked ||
                  moving ||
                  songPending ||
                  position.position === 1 ||
                  (isEntrust && pauseFlow.busy),
              }}
              onPress={() => move(-1)}
              style={[
                styles.previous,
                (blocked ||
                  moving ||
                  songPending ||
                  position.position === 1 ||
                  (isEntrust && pauseFlow.busy)) &&
                  styles.disabled,
              ]}
            >
              <Text style={styles.previousLabel}>← 이전 양</Text>
            </Pressable>
            {!isStopOffer && (
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
                    blocked ||
                    moving ||
                    songPending ||
                    (isEntrust && (pauseFlow.busy || !pauseFlow.action)) ||
                    (position.position === cards.length && fluffPending)
                  }
                  onPress={() => {
                    if (position.position === cards.length) finish('completed');
                    else move(1);
                  }}
                />
              </View>
            )}
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
    fontSize: 14,
    lineHeight: 21,
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
  expandedTopbar: { flexDirection: 'column', alignItems: 'stretch', gap: 4 },
  progress: {
    fontFamily: theme.font,
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 27,
    color: theme.color.text,
  },
  preview: {
    fontFamily: theme.font,
    fontSize: 14,
    lineHeight: 21,
    color: theme.color.muted,
  },
  exit: { minHeight: 48, justifyContent: 'center', paddingLeft: 12 },
  exitLabel: {
    fontFamily: theme.font,
    fontSize: 14,
    lineHeight: 21,
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
    fontSize: 14,
    lineHeight: 21,
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
    fontSize: 18,
    lineHeight: 27,
    includeFontPadding: false,
    color: theme.color.text,
  },
  disabled: { opacity: 0.4 },
  next: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', padding: 20, gap: 20 },
  message: {
    fontFamily: theme.font,
    fontSize: 18,
    lineHeight: 27,
    color: theme.color.text,
    textAlign: 'center',
  },
});

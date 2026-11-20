import { useLiveService } from '../live/ServiceMode';
import { DecorationPicker } from '../decoration/DecorationPicker';
import { DecorationScreen } from '../decoration/DecorationScreen';
import { MyCardsWritingFlow } from '../myCards/MyCardsWritingFlow';
import type { MyCardsWritingSource } from '../myCards/types';
import { SettingsScreen } from '../settings/SettingsScreen';
import { SavedSongsScreen } from '../songs/SavedSongsScreen';
import { songExternal } from '../songs/songExternal';
import { ReflectionScreen } from './ReflectionScreen';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { theme } from '../../ui/theme';
import { DayScreen } from './DayScreen';
import { SheepArt } from './SheepArt';
import { canAdopt, useMorningFlow } from './useMorningFlow';
import type { MorningActions, MorningCandidate } from './types';
import {
  SheepDetailWritingFlow,
  createSheepWritingSessions,
} from '../flock/SheepDetailWritingFlow';
import type { SheepDetailLoad } from '../flock/types';
import { DeferredWritingSection } from './DeferredWritingSection';
import { ReceivedYarnSection } from '../yarnSummary/ReceivedYarnSection';
import { FortuneSection } from '../fortune/FortuneSection';
import { MorningHomeHeader } from './MorningHomeHeader';
import { HomeSavedSong } from './HomeSavedSong';
import { MorningPasture } from './MorningPasture';
import { useSheepArrival } from './useSheepArrival';

function Action({
  label,
  onPress,
  disabled = false,
  primary = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        primary && styles.primary,
        (disabled || pressed) && styles.dim,
      ]}
    >
      <Text style={[styles.text, styles.actionLabel]}>{label}</Text>
    </Pressable>
  );
}
const candidateLabel = (item: MorningCandidate, withSession: boolean) =>
  `${withSession ? `${item.session_number ?? 1}번째 세기 · ` : ''}${item.position === null ? '마무리 카드' : `${item.position}번째 양`}`;
function CandidateDetail({
  item,
  withSession,
}: {
  item: MorningCandidate;
  withSession: boolean;
}) {
  if (!item.card.available || !item.card.content) return null;
  const { card } = item;
  return (
    <View style={styles.card}>
      <Text style={[styles.text, styles.small]}>
        {candidateLabel(item, withSession)} ·{' '}
        {card.kind === 'song' ? '노래 추천' : '짧은 글'}
        {item.fluff_saved ? ' · 담은 솜털' : ''}
      </Text>
      {card.kind === 'song' && card.content ? (
        <>
          <Text style={[styles.text, styles.song]}>
            {card.content.track.title} · {card.content.track.artist}
          </Text>
          {card.author_type !== 'ai' && card.content.recommendation && (
            <Text style={[styles.text, theme.contentText]}>
              {card.content.recommendation}
            </Text>
          )}
        </>
      ) : card.kind === 'text' && card.content ? (
        <Text style={[styles.text, theme.contentText]}>
          {card.content.text}
        </Text>
      ) : null}
      {card.author_type !== 'ai' && card.author_label && (
        <Text style={[styles.text, styles.small]}>{card.author_label}</Text>
      )}
    </View>
  );
}
export function MorningScreen(props: Parameters<typeof MorningSession>[0]) {
  const [source, setSource] = useState({
    actions: props.actions,
    cards: props.myCards,
    version: 0,
  });
  if (source.actions !== props.actions || source.cards !== props.myCards)
    setSource({
      actions: props.actions,
      cards: props.myCards,
      version: source.version + 1,
    });
  return <MorningSession key={source.version} {...props} />;
}
function MorningSession({
  actions,
  onExit,
  loadDetail,
  homeFooter,
  homeWhenNoCandidates = false,
  homeBlocked = false,
  fortuneKey,
  myCards,
}: {
  actions: MorningActions;
  onExit: () => void;
  loadDetail?: SheepDetailLoad;
  homeFooter?: (blocked: boolean) => ReactNode;
  homeWhenNoCandidates?: boolean;
  homeBlocked?: boolean;
  fortuneKey?: string;
  myCards?: MyCardsWritingSource;
}) {
  const live = useLiveService();
  const [sheepWriting] = useState(() =>
    myCards ? createSheepWritingSessions(myCards) : undefined,
  );
  const [decorationPicking, setDecorationPicking] = useState(false);
  const [decorationId, setDecorationId] = useState<string | null>(null);
  const [decorationNotice, setDecorationNotice] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [songsOpen, setSongsOpen] = useState(false);
  const [reflectionOpen, setReflectionOpen] = useState(false);
  const [deferredWritingOpen, setDeferredWritingOpen] = useState(false);
  const [fortuneOpen, setFortuneOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cardsOpen, setCardsOpen] = useState(false);
  const [fortuneVersion, setFortuneVersion] = useState(0);
  const { width } = useWindowDimensions();
  const scale = Math.min(width, 480) / 360;
  const flow = useMorningFlow(actions, onExit, homeWhenNoCandidates);
  const { morning, busy, failure } = flow;
  const {
    scrollRef,
    onContentSizeChange,
    onScrollBeginDrag,
    onPastureLayout,
    onSheepLayout,
    ready,
    reducedMotion,
    layoutKey,
  } = useSheepArrival(
    flow.newId,
    flow.page === 'home' &&
      !busy &&
      failure !== 'flock' &&
      flow.newSheepInFlock &&
      !homeBlocked &&
      !decorationPicking &&
      decorationId === null &&
      !cardsOpen &&
      !settingsOpen &&
      detailId === null &&
      !songsOpen &&
      !reflectionOpen &&
      !deferredWritingOpen &&
      !fortuneOpen,
    flow.flockVersion,
  );
  const multipleSessions =
    morning?.candidate_cards.some((item) => (item.session_number ?? 1) > 1) ??
    false;
  const hasCandidates =
    !!morning?.night && morning.candidate_cards.some(canAdopt);
  const homeHeading = (yarn?: ReactNode) => (
    <MorningHomeHeader
      key={fortuneVersion}
      date={fortuneKey}
      settings={actions.settings}
      profileVisible={!settingsOpen && !cardsOpen && detailId === null}
      onSettings={() => setSettingsOpen(true)}
      onCards={myCards ? () => setCardsOpen(true) : undefined}
      yarn={yarn}
    />
  );
  return (
    <DayScreen home={flow.page === 'home'}>
      <ScrollView
        key={flow.page}
        ref={scrollRef}
        onContentSizeChange={onContentSizeChange}
        onScrollBeginDrag={onScrollBeginDrag}
        contentContainerStyle={
          flow.page === 'home' ? styles.homeContent : styles.content
        }
      >
        {flow.page === 'home' ? (
          <>
            <View style={[styles.overview, { minHeight: 336 * scale }]}>
              {!actions.receivedYarn && homeHeading()}
              {actions.receivedYarn && (
                <ReceivedYarnSection
                  actions={actions.receivedYarn}
                  compact
                  renderContent={(trigger, feedback) => (
                    <>
                      {homeHeading(trigger)}
                      {feedback}
                    </>
                  )}
                  blocked={
                    homeBlocked ||
                    decorationPicking ||
                    decorationId !== null ||
                    cardsOpen ||
                    settingsOpen ||
                    detailId !== null ||
                    songsOpen ||
                    reflectionOpen ||
                    deferredWritingOpen ||
                    fortuneOpen
                  }
                />
              )}
              {morning?.night &&
                morning.writing_offer?.state === 'deferred' &&
                actions.writing && (
                  <DeferredWritingSection
                    key={morning.night.id}
                    nightId={morning.night.id}
                    writing={actions.writing}
                    loadMorning={actions.loadMorning}
                    onVisibilityChange={setDeferredWritingOpen}
                  />
                )}
              {busy && (
                <ActivityIndicator
                  accessibilityLabel="양떼 불러오는 중"
                  color="#2F3A9E"
                />
              )}
              {failure === 'flock' && (
                <View style={styles.card}>
                  <Text style={styles.text}>
                    양떼를 모두 불러오지 못했어요. 데려온 양은 그대로 있어요.
                  </Text>
                  <Action label="양떼 다시 불러오기" onPress={flow.openFlock} />
                </View>
              )}
              {!busy && !failure && flow.items.length === 0 && (
                <View style={styles.card}>
                  <Text style={styles.text}>아직 양떼가 비어 있어요</Text>
                  <Text style={[styles.text, styles.small]}>
                    밤에 만난 양을 아침에 데려와 보세요.
                  </Text>
                </View>
              )}
              {decorationNotice && (
                <Text
                  accessibilityLiveRegion="polite"
                  style={[styles.text, styles.card]}
                >
                  {decorationNotice}
                </Text>
              )}
              {actions.songs && (
                <HomeSavedSong
                  actions={actions.songs}
                  paused={songsOpen}
                  onOpen={() => setSongsOpen(true)}
                />
              )}
            </View>
            {flow.newId && (
              <Text
                accessibilityLiveRegion="polite"
                style={[styles.text, styles.card]}
              >
                한 마리가 양떼에 도착했어요.
              </Text>
            )}
            <View
              key={layoutKey}
              collapsable={false}
              testID="morning-pasture"
              onLayout={onPastureLayout}
            />
            <MorningPasture
              paused={
                homeBlocked ||
                busy ||
                failure === 'flock' ||
                decorationPicking ||
                decorationId !== null ||
                cardsOpen ||
                settingsOpen ||
                detailId !== null ||
                songsOpen ||
                reflectionOpen ||
                deferredWritingOpen ||
                fortuneOpen
              }
              layoutKey={layoutKey}
              arrival={
                flow.newSheepInFlock ? { ready, reducedMotion } : undefined
              }
              onSheepLayout={onSheepLayout}
              items={flow.items}
              lastNightId={
                !fortuneKey ||
                (morning?.night?.night_date &&
                  new Date(
                    Date.parse(`${morning.night.night_date}T00:00:00Z`) +
                      86400000,
                  )
                    .toISOString()
                    .slice(0, 10) === fortuneKey)
                  ? morning?.night?.id
                  : undefined
              }
              newId={flow.newId}
              onSelect={loadDetail ? setDetailId : undefined}
              onDecorate={
                actions.decoration && flow.items.length > 0
                  ? () => {
                      setDecorationNotice('');
                      setDecorationPicking(true);
                    }
                  : undefined
              }
              fortune={
                actions.fortune && (
                  <FortuneSection
                    key={`${fortuneKey ?? ''}:${fortuneVersion}`}
                    actions={actions.fortune}
                    compact
                    onVisibilityChange={setFortuneOpen}
                    blocked={
                      decorationPicking ||
                      decorationId !== null ||
                      cardsOpen ||
                      settingsOpen ||
                      detailId !== null ||
                      songsOpen ||
                      reflectionOpen ||
                      deferredWritingOpen
                    }
                  />
                )
              }
            />
          </>
        ) : failure === 'morning' || failure === 'refresh' ? (
          <View style={styles.card}>
            <Text style={[styles.text, styles.song]}>
              {failure === 'refresh'
                ? '최신 양 정보를 확인해야 해요'
                : '아침 기록을 불러오지 못했어요'}
            </Text>
            <Action
              label="다시 불러오기"
              disabled={busy}
              onPress={flow.retryMorning}
            />
          </View>
        ) : !morning ? (
          <View style={styles.loading}>
            <ActivityIndicator color="#2F3A9E" />
            <Text style={styles.text}>아침 기록을 불러오고 있어요</Text>
          </View>
        ) : (
          <>
            <View>
              <Text style={[styles.text, styles.title]}>잘 잤어요?</Text>
              <Text
                accessibilityRole="header"
                style={[styles.text, styles.title]}
              >
                {morning.night
                  ? `어젯밤 양 ${morning.counted_sheep ?? 0}마리가\n넘어갔어요`
                  : '아직 어젯밤 기록이 없어요'}
              </Text>
              <Text style={[styles.text, styles.subtitle]}>
                한 마리를 양떼로 데려올까요?
              </Text>
            </View>
            {flow.notice && (
              <Text accessibilityLiveRegion="polite" style={styles.text}>
                {flow.notice}
              </Text>
            )}
            {morning.candidate_cards.length > 0 && (
              <View
                accessibilityRole="radiogroup"
                accessibilityLabel="데려올 양 선택"
                style={styles.grid}
              >
                {morning.candidate_cards.map((item) => {
                  const unavailable =
                    !item.card.available || !item.card.content;
                  const disabled = busy || !canAdopt(item);
                  const selected = item.card.id === flow.selected?.card.id;
                  const label = `${candidateLabel(item, multipleSessions)}${unavailable ? ' · 볼 수 없는 카드' : !item.can_adopt ? ' · 데려올 수 없는 양' : ''}`;
                  return (
                    <View
                      style={[
                        styles.cell,
                        multipleSessions && styles.sessionCell,
                      ]}
                      key={item.card.id}
                    >
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityLabel={label}
                        accessibilityHint={
                          item.fluff_saved
                            ? '밤에 솜털을 붙인 카드예요.'
                            : undefined
                        }
                        accessibilityState={{ checked: selected, disabled }}
                        disabled={disabled}
                        onPress={() => flow.select(item.card.id)}
                        style={[
                          styles.choice,
                          multipleSessions && styles.sessionChoice,
                          selected && styles.selected,
                          !canAdopt(item) && styles.dim,
                        ]}
                      >
                        <SheepArt
                          colorKey={unavailable ? null : item.card.category_id}
                        />
                        {multipleSessions && (
                          <Text style={[styles.text, styles.candidateLabel]}>
                            {candidateLabel(item, true).replace(' · ', ' ·\n')}
                          </Text>
                        )}
                        {item.fluff_saved && (
                          <Text style={[styles.text, styles.fluffMark]}>
                            솜털
                          </Text>
                        )}
                        {!canAdopt(item) && (
                          <Text style={[styles.text, styles.unavailable]}>
                            선택 불가
                          </Text>
                        )}
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}
            {flow.selected && (
              <CandidateDetail
                item={flow.selected}
                withSession={multipleSessions}
              />
            )}
            {hasCandidates && !flow.selected && (
              <View style={styles.card}>
                <Text style={styles.text}>데려올 양을 골라 주세요.</Text>
              </View>
            )}
            {!hasCandidates && morning.night && (
              <View style={styles.card}>
                <Text style={styles.text}>데려올 수 있는 양이 없어요</Text>
                <Text style={[styles.text, styles.small]}>
                  다음 밤에 만난 양을 데려올 수 있어요.
                </Text>
              </View>
            )}
            {failure === 'save' && (
              <Text
                accessibilityRole="alert"
                style={[styles.text, styles.error]}
              >
                양을 데려오지 못했어요. 선택은 그대로예요. 다시 시도해 주세요.
              </Text>
            )}
            <View style={styles.spacer} />
            {busy && (
              <ActivityIndicator
                accessibilityLabel="양 정보 확인 중"
                color="#2F3A9E"
              />
            )}
            {hasCandidates ? (
              <Action
                label="이 양 데려오기"
                primary
                disabled={busy || !flow.selected}
                onPress={flow.adopt}
              />
            ) : (
              <Action
                label="양떼 보기"
                primary
                disabled={busy}
                onPress={flow.openFlock}
              />
            )}
          </>
        )}
        <View style={flow.page === 'home' ? styles.homeActions : undefined}>
          {actions.reflection && morning?.night && (
            <Action
              label="어젯밤 돌아보기"
              onPress={() => setReflectionOpen(true)}
            />
          )}
          {actions.songs && morning?.night && (
            <Action label="담은 노래 보기" onPress={() => setSongsOpen(true)} />
          )}
          {!live && <Action label="미리보기 나가기" onPress={flow.exit} />}
        </View>
      </ScrollView>
      {flow.page === 'home' && homeFooter && (
        <View style={styles.homeFooter}>
          {homeFooter(
            decorationPicking ||
              decorationId !== null ||
              detailId !== null ||
              songsOpen ||
              reflectionOpen ||
              deferredWritingOpen ||
              fortuneOpen ||
              settingsOpen ||
              cardsOpen,
          )}
        </View>
      )}
      {decorationPicking && decorationId === null && (
        <DecorationPicker
          items={flow.items}
          onSelect={setDecorationId}
          onBack={() => setDecorationPicking(false)}
        />
      )}
      {decorationId !== null && actions.decoration && (
        <DecorationScreen
          modal
          sheepId={decorationId}
          actions={actions.decoration}
          onRead={flow.applyDecoration}
          onBack={() => setDecorationId(null)}
          onSaved={(sheep) => {
            flow.applyDecoration(sheep);
            setDecorationId(null);
            setDecorationPicking(false);
            setDecorationNotice('꾸미기를 저장했어요.');
          }}
        />
      )}
      <Modal
        testID="saved-songs-modal"
        visible={songsOpen}
        animationType="none"
        onRequestClose={() => setSongsOpen(false)}
        statusBarTranslucent
        navigationBarTranslucent
      >
        {songsOpen && actions.songs && (
          <SavedSongsScreen
            actions={actions.songs}
            external={songExternal}
            onBack={() => setSongsOpen(false)}
          />
        )}
      </Modal>
      <Modal
        testID="reflection-modal"
        visible={reflectionOpen}
        animationType="none"
        onRequestClose={() => setReflectionOpen(false)}
        statusBarTranslucent
        navigationBarTranslucent
      >
        {reflectionOpen && morning?.night && actions.reflection && (
          <ReflectionScreen
            key={morning.night.id}
            nightId={morning.night.id}
            actions={actions.reflection}
            worries={actions.worries}
            onBack={() => setReflectionOpen(false)}
          />
        )}
      </Modal>
      <Modal
        testID="sheep-detail-modal"
        visible={detailId !== null}
        animationType="none"
        onRequestClose={() => setDetailId(null)}
        statusBarTranslucent
        navigationBarTranslucent
      >
        {detailId !== null && loadDetail && (
          <SheepDetailWritingFlow
            writing={sheepWriting}
            key={detailId}
            sheepId={detailId}
            load={loadDetail}
            worries={actions.worries}
            onBack={() => setDetailId(null)}
          />
        )}
      </Modal>
      {cardsOpen && myCards && (
        <Modal
          visible
          animationType="none"
          statusBarTranslucent
          navigationBarTranslucent
          onRequestClose={() => setCardsOpen(false)}
        >
          <MyCardsWritingFlow
            source={myCards}
            settings={actions.settings}
            onBack={() => {
              setCardsOpen(false);
              setFortuneVersion((value) => value + 1);
            }}
          />
        </Modal>
      )}
      {settingsOpen && actions.settings && (
        <SettingsScreen
          modal
          actions={actions.settings}
          onBack={() => {
            setSettingsOpen(false);
            setFortuneVersion((value) => value + 1);
          }}
        />
      )}
    </DayScreen>
  );
}
const styles = StyleSheet.create({
  homeFooter: { backgroundColor: '#73AE8A' },
  homeContent: { flexGrow: 1 },
  overview: {
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 20,
    gap: 12,
  },
  homeActions: { padding: 20, gap: 8 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    gap: 16,
  },
  text: {
    fontFamily: theme.font,
    color: '#2F3A9E',
    fontSize: 16,
    lineHeight: 24,
    includeFontPadding: false,
  },
  title: { fontSize: 24, lineHeight: 36, fontWeight: '700' },
  subtitle: { fontSize: 14, marginTop: 8, color: '#4A5290' },
  small: { fontSize: 14, lineHeight: 21, color: '#4A5290' },
  fluffMark: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
  song: { fontSize: 18, fontWeight: '700' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.28)',
    minHeight: 150,
    alignContent: 'center',
  },
  cell: { width: '20%', alignItems: 'center', paddingVertical: 8 },
  sessionCell: { width: '50%', paddingHorizontal: 2 },
  sessionChoice: {
    width: '100%',
    padding: 6,
    gap: 4,
    backgroundColor: '#F2F4FF',
  },
  candidateLabel: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  choice: {
    width: 50,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selected: { borderColor: '#2F3A9E', backgroundColor: '#FFFFFF' },
  dim: { opacity: 0.5 },
  unavailable: { fontSize: 12, lineHeight: 18 },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#2F3A9E',
    padding: 14,
    gap: 8,
    boxShadow: '5px 5px 0 #AFC0FF',
  },
  action: {
    minHeight: 48,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    minHeight: 52,
    backgroundColor: '#FFE7A3',
    boxShadow: '5px 5px 0 #D9B65E',
  },
  actionLabel: { fontWeight: '700', textAlign: 'center' },
  spacer: { flex: 1, minHeight: 40 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  error: { backgroundColor: '#FFF1E6', padding: 12 },
});

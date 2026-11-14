import { SavedSongsScreen } from '../songs/SavedSongsScreen';
import { songExternal } from '../songs/songExternal';
import { ReflectionScreen } from './ReflectionScreen';
import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { theme } from '../../ui/theme';
import { DayScreen } from './DayScreen';
import { SheepArt } from './SheepArt';
import { canAdopt, useMorningFlow } from './useMorningFlow';
import type { MorningActions, MorningCandidate } from './types';
import { SheepDetailScreen } from '../flock/SheepDetailScreen';
import type { SheepDetailLoad } from '../flock/types';
import { DeferredWritingSection } from './DeferredWritingSection';
import { ReceivedYarnSection } from '../yarnSummary/ReceivedYarnSection';
import { FortuneSection } from '../fortune/FortuneSection';

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
const candidateLabel = (item: MorningCandidate) =>
  item.position === null ? '마무리 카드' : `${item.position}번째 양`;
function CandidateDetail({ item }: { item: MorningCandidate }) {
  if (!item.card.available || !item.card.content) return null;
  const { card } = item;
  return (
    <View style={styles.card}>
      <Text style={[styles.text, styles.small]}>
        {candidateLabel(item)} ·{' '}
        {card.kind === 'song' ? '노래 추천' : '짧은 글'}
        {item.fluff_saved ? ' · 담은 솜털' : ''}
      </Text>
      {card.kind === 'song' && card.content ? (
        <>
          <Text style={[styles.text, styles.song]}>
            {card.content.track.title} · {card.content.track.artist}
          </Text>
          {card.author_type !== 'ai' && card.content.recommendation && (
            <Text style={styles.text}>{card.content.recommendation}</Text>
          )}
        </>
      ) : card.kind === 'text' && card.content ? (
        <Text style={styles.text}>{card.content.text}</Text>
      ) : null}
      {card.author_type !== 'ai' && card.author_label && (
        <Text style={[styles.text, styles.small]}>{card.author_label}</Text>
      )}
    </View>
  );
}
export function MorningScreen(props: Parameters<typeof MorningSession>[0]) {
  const [source, setSource] = useState({ actions: props.actions, version: 0 });
  if (source.actions !== props.actions)
    setSource({ actions: props.actions, version: source.version + 1 });
  return <MorningSession key={source.version} {...props} />;
}
function MorningSession({
  actions,
  onExit,
  loadDetail,
}: {
  actions: MorningActions;
  onExit: () => void;
  loadDetail?: SheepDetailLoad;
}) {
  const [detailId, setDetailId] = useState<string | null>(null);
  const [songsOpen, setSongsOpen] = useState(false);
  const [reflectionOpen, setReflectionOpen] = useState(false);
  const [deferredWritingOpen, setDeferredWritingOpen] = useState(false);
  const [fortuneOpen, setFortuneOpen] = useState(false);
  const flow = useMorningFlow(actions, onExit);
  const { morning, busy, failure } = flow;
  const hasCandidates =
    !!morning?.night && morning.candidate_cards.some(canAdopt);
  return (
    <DayScreen home={flow.page === 'home'}>
      <ScrollView key={flow.page} contentContainerStyle={styles.content}>
        {flow.page === 'home' ? (
          <>
            <Text
              accessibilityRole="header"
              style={[styles.text, styles.title]}
            >
              나의 양떼
            </Text>
            <Text style={styles.text}>밤을 함께 보낸 양들이 쉬고 있어요.</Text>
            {actions.receivedYarn && (
              <ReceivedYarnSection
                actions={actions.receivedYarn}
                blocked={
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
            {flow.newId && (
              <Text
                accessibilityLiveRegion="polite"
                style={[styles.text, styles.card]}
              >
                한 마리가 양떼에 도착했어요.
              </Text>
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
            <View style={styles.homeSpacer} />
            <View style={styles.pasture}>
              {actions.fortune && (
                <FortuneSection
                  actions={actions.fortune}
                  onVisibilityChange={setFortuneOpen}
                  blocked={
                    detailId !== null ||
                    songsOpen ||
                    reflectionOpen ||
                    deferredWritingOpen
                  }
                />
              )}
              {flow.items.map((item) => (
                <Pressable
                  key={item.id}
                  accessible
                  accessibilityRole={loadDetail ? 'button' : undefined}
                  disabled={!loadDetail}
                  onPress={() => setDetailId(item.id)}
                  accessibilityLabel={`${item.night_date}의 양${item.id === flow.newId ? ' · 새로 온 양' : ''}`}
                  style={[
                    styles.flockSheep,
                    item.id === flow.newId && styles.newSheep,
                  ]}
                >
                  <SheepArt colorKey={item.color_key} large />
                  <Text style={[styles.text, styles.date]}>
                    {item.night_date.slice(5).replace('-', '.')}
                  </Text>
                  {item.id === flow.newId && (
                    <Text style={[styles.text, styles.badge]}>새로 온 양</Text>
                  )}
                </Pressable>
              ))}
            </View>
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
                  const label = `${candidateLabel(item)}${unavailable ? ' · 볼 수 없는 카드' : !item.can_adopt ? ' · 데려올 수 없는 양' : ''}`;
                  return (
                    <View style={styles.cell} key={item.card.id}>
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
                          selected && styles.selected,
                          !canAdopt(item) && styles.dim,
                        ]}
                      >
                        <SheepArt
                          colorKey={unavailable ? null : item.card.category_id}
                        />
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
            {flow.selected && <CandidateDetail item={flow.selected} />}
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
        {actions.reflection && morning?.night && (
          <Action
            label="어젯밤 돌아보기"
            onPress={() => setReflectionOpen(true)}
          />
        )}
        {actions.songs && morning?.night && (
          <Action label="담은 노래 보기" onPress={() => setSongsOpen(true)} />
        )}
        <Action label="미리보기 나가기" onPress={flow.exit} />
      </ScrollView>
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
          <SheepDetailScreen
            key={detailId}
            sheepId={detailId}
            load={loadDetail}
            onBack={() => setDetailId(null)}
          />
        )}
      </Modal>
    </DayScreen>
  );
}
const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 20, gap: 16 },
  text: {
    fontFamily: theme.font,
    color: '#2F3A9E',
    fontSize: 14,
    lineHeight: 22,
    includeFontPadding: false,
  },
  title: { fontSize: 22, lineHeight: 31, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 8, color: '#4A5290' },
  small: { fontSize: 11, lineHeight: 18, color: '#4A5290' },
  fluffMark: { fontSize: 9, lineHeight: 14, textAlign: 'center' },
  song: { fontSize: 15, fontWeight: '700' },
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
  unavailable: { fontSize: 9, lineHeight: 13 },
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
  homeSpacer: { flexGrow: 1, minHeight: 180 },
  pasture: {
    flexGrow: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'flex-start',
    gap: 16,
    paddingVertical: 20,
  },
  flockSheep: {
    minWidth: 76,
    minHeight: 92,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  newSheep: {
    borderWidth: 2,
    borderColor: '#FFE7A3',
    backgroundColor: 'rgba(255,231,163,0.65)',
  },
  date: { fontSize: 10, lineHeight: 16 },
  badge: { fontSize: 10, lineHeight: 16, backgroundColor: '#FFE7A3' },
});

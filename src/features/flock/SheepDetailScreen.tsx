import { useState } from 'react';
import type { WorryDeletions } from '../worries/deletions';
import { WorryDeleteDialog } from '../worries/WorryDeleteDialog';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { DayScreen } from '../morning/DayScreen';
import { categories } from '../night/categories';
import { theme } from '../../ui/theme';
import type { Card } from '../../api/contracts';
import type { ReflectionAnswer, SheepDetail, SheepDetailLoad } from './types';
import { useSheepDetail } from './useSheepDetail';

const reflectionLabels: Record<ReflectionAnswer, string> = {
  same: '그대로예요',
  smaller: '작아졌어요',
  much_better: '생각보다 너무 괜찮아요',
  bigger: '더 커졌어요',
  new_worry: '다른 고민이 생겼어요',
  cannot_recall: '기억이 잘 안 나요',
};
function dateLabel(value: string, year = false) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match
    ? `${year ? `${match[1]}년 ` : ''}${Number(match[2])}월 ${Number(match[3])}일`
    : '기록한 날';
}
function SavedCard({ card }: { card: Card }) {
  if (!card.available || !card.content)
    return (
      <View style={styles.card}>
        <Text style={styles.body}>지금은 이 카드를 볼 수 없어요</Text>
        <Text style={styles.caption}>
          함께한 양과 남아 있는 밤 기록은 그대로예요.
        </Text>
      </View>
    );
  return (
    <View style={styles.card}>
      {card.kind === 'text' && card.content ? (
        <Text style={styles.body}>{card.content.text}</Text>
      ) : card.kind === 'song' && card.content ? (
        <>
          <Text style={styles.caption}>노래 추천</Text>
          <Text style={styles.body}>{card.content.track.title}</Text>
          <Text style={styles.artist}>{card.content.track.artist}</Text>
          {card.author_type !== 'ai' && card.content.recommendation && (
            <Text style={styles.body}>{card.content.recommendation}</Text>
          )}
        </>
      ) : null}
      {card.author_type !== 'ai' && card.author_label && (
        <Text style={styles.caption}>— {card.author_label}</Text>
      )}
    </View>
  );
}
function NightRecord({ detail }: { detail: SheepDetail }) {
  const { night, position, sheep_count: count } = detail;
  const category = categories.find((item) => item.id === night.category_id);
  const order =
    position !== null &&
    count !== null &&
    Number.isInteger(position) &&
    Number.isInteger(count) &&
    position > 0 &&
    position <= count
      ? ` · ${count}마리 중 ${position}번째`
      : '';
  const hasWorry = night.category_id !== 'none' && !!night.worry_text?.trim();
  return (
    <>
      <View style={styles.metadataPanel}>
        <Text style={styles.metadata}>
          {dateLabel(night.night_date, true)} 밤
          {category
            ? ` · ${category.label}${category.id === 'none' ? '' : ' 고민'}`
            : ''}
          {order}
        </Text>
      </View>
      <View style={styles.record}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          그 밤의 고민
        </Text>
        <Text style={styles.recordText}>
          {night.category_id === 'none'
            ? '고민 없이 쉬어 간 밤이에요.'
            : hasWorry
              ? night.worry_text
              : '남아 있는 고민 기록이 없어요.'}
        </Text>
      </View>
      {night.category_id !== 'none' && night.reflection && (
        <View style={styles.record}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            그날의 돌아보기
          </Text>
          <Text style={[styles.recordText, styles.answer]}>
            {reflectionLabels[night.reflection.answer]}
          </Text>
          <Text style={styles.recordText}>{night.reflection.message}</Text>
        </View>
      )}
    </>
  );
}
type DetailProps = {
  sheepId: string;
  load: SheepDetailLoad;
  onBack: () => void;
  worries?: WorryDeletions;
};
export function SheepDetailScreen(props: DetailProps) {
  const [source, setSource] = useState({
    id: props.sheepId,
    load: props.load,
    worries: props.worries,
    version: 0,
  });
  if (
    source.id !== props.sheepId ||
    source.load !== props.load ||
    source.worries !== props.worries
  ) {
    setSource({
      id: props.sheepId,
      load: props.load,
      worries: props.worries,
      version: source.version + 1,
    });
  }
  return <DetailSession key={source.version} {...props} />;
}
function DetailSession({ sheepId, load, onBack, worries }: DetailProps) {
  const [target, setTarget] = useState<{ id: string; date: string } | null>(
    null,
  );
  const [deleted, setDeleted] = useState(false);
  const { result, retry, back } = useSheepDetail(
    sheepId,
    load,
    onBack,
    worries,
  );
  return (
    <DayScreen>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="양떼로 돌아가기"
          hitSlop={8}
          onPress={back}
          style={styles.back}
        >
          <Text style={styles.arrow}>←</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.heading}>
          {result.phase === 'ready'
            ? `${dateLabel(result.detail.sheep.night_date)} 밤의 양`
            : '양의 기록'}
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {result.phase === 'loading' ? (
          <View style={styles.state}>
            <ActivityIndicator color="#2F3A9E" />
            <Text style={styles.recordText}>양의 기록을 불러오고 있어요</Text>
          </View>
        ) : result.phase === 'ready' ? (
          <>
            <SavedCard card={result.detail.card} />
            <NightRecord detail={result.detail} />
            {worries &&
              result.detail.night.category_id !== 'none' &&
              result.detail.night.worry_text?.trim() &&
              result.detail.sheep.night_id.trim() &&
              result.detail.night.night_date ===
                result.detail.sheep.night_date && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="고민 삭제"
                  style={styles.retry}
                  onPress={() =>
                    setTarget({
                      id: result.detail.sheep.night_id,
                      date: result.detail.sheep.night_date,
                    })
                  }
                >
                  <Text style={styles.writeLabel}>고민 삭제</Text>
                </Pressable>
              )}
            {deleted && (
              <View style={styles.record}>
                <Text
                  accessibilityLiveRegion="polite"
                  style={styles.recordText}
                >
                  고민을 지웠어요. 양과 카드는 그대로예요.
                </Text>
              </View>
            )}
            <View style={styles.spacer} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="카드 쓰기 · 준비 중"
              accessibilityState={{ disabled: true }}
              disabled
              style={styles.writeButton}
            >
              <Text style={styles.writeLabel}>카드 쓰기 · 준비 중</Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.card}>
            <Text accessibilityRole="alert" style={styles.body}>
              {result.phase === 'unavailable'
                ? '이 양의 기록을 볼 수 없어요'
                : '기록을 불러오지 못했어요'}
            </Text>
            <Text style={styles.recordText}>
              {result.phase === 'unavailable'
                ? '양떼로 돌아가 다른 양을 확인해 주세요.'
                : '잠시 후 다시 불러와 주세요.'}
            </Text>
            {result.phase === 'error' && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="다시 불러오기"
                onPress={retry}
                style={styles.retry}
              >
                <Text style={styles.writeLabel}>다시 불러오기</Text>
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>
      {target && worries && (
        <WorryDeleteDialog
          nightId={target.id}
          nightDate={target.date}
          source={worries}
          onCancel={() => setTarget(null)}
          onDeleted={() => {
            setDeleted(true);
            setTarget(null);
          }}
        />
      )}
    </DayScreen>
  );
}
const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    minHeight: 52,
    paddingRight: 20,
  },
  back: {
    width: 36,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  arrow: {
    fontFamily: theme.font,
    color: '#242565',
    fontSize: 26,
    lineHeight: 32,
  },
  heading: {
    flex: 1,
    fontFamily: theme.font,
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 24,
    color: '#242565',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 30,
    gap: 14,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#3B4FB8',
    padding: 22,
    gap: 16,
    boxShadow: '5px 5px 0 #AFC0FF',
  },
  body: {
    fontFamily: theme.font,
    fontWeight: '500',
    color: '#242565',
    fontSize: 19,
    lineHeight: 31,
    includeFontPadding: false,
  },
  caption: {
    fontFamily: theme.font,
    color: '#4A5290',
    fontSize: 13,
    lineHeight: 20,
  },
  artist: {
    fontFamily: theme.font,
    color: '#4A5290',
    fontSize: 15,
    lineHeight: 23,
  },
  metadataPanel: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  metadata: {
    fontFamily: theme.font,
    color: '#4A5290',
    fontSize: 12,
    lineHeight: 18,
  },
  sectionTitle: {
    fontFamily: theme.font,
    fontWeight: '700',
    color: '#4A5290',
    fontSize: 13,
    lineHeight: 20,
  },
  record: {
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#3B4FB8',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    boxShadow: '5px 5px 0 #AFC0FF',
  },
  recordText: {
    fontFamily: theme.font,
    color: '#4A5290',
    fontSize: 12,
    lineHeight: 19,
    includeFontPadding: false,
  },
  answer: { fontWeight: '700', fontSize: 14, lineHeight: 22 },
  spacer: { flexGrow: 1, minHeight: 40 },
  writeButton: {
    minHeight: 52,
    padding: 14,
    backgroundColor: '#FFE7A3',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '5px 5px 0 #D9B65E',
    opacity: 0.65,
  },
  writeLabel: {
    fontFamily: theme.font,
    color: '#2F3A9E',
    fontWeight: '700',
    fontSize: 15,
    lineHeight: 22,
  },
  retry: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFE7A3',
  },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
});

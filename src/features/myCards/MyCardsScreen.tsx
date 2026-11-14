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
  useWindowDimensions,
} from 'react-native';
import { NightScreen } from '../../ui/NightScreen';
import { Notice } from '../../ui/Notice';
import { Button } from '../../ui/Button';
import { theme } from '../../ui/theme';
import { useMyCards } from './useMyCards';
import { CardDeleteDialog } from './CardDeleteDialog';
import type {
  MyCardsActions,
  MyCardDeleteActions,
  MyCardsFilter,
  Submission,
} from './types';

const filters = [
  ['all', '전체'],
  ['pending', '검수 중'],
  ['rejected', '반려'],
] as const;
const badges = {
  approved: { label: '게시됨', color: '#B7E3CC' },
  pending: { label: '검수 중', color: '#FFE7A3' },
  rejected: { label: '반려됨', color: '#F9CFDD' },
};
const date = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Seoul',
  month: 'numeric',
  day: 'numeric',
});
export function MyCardsScreen({
  actions,
  deletions,
  onBack,
  onWrite,
  submissionConfirmed = false,
}: {
  actions: MyCardsActions;
  deletions?: MyCardDeleteActions;
  onBack: () => void;
  onWrite?: () => void;
  submissionConfirmed?: boolean;
}) {
  const [confirmNotice, setConfirmNotice] = useState(submissionConfirmed);
  const [filter, setFilter] = useState<MyCardsFilter>('all');
  const [selection, setSelection] = useState<{
    source: MyCardsActions;
    deletions: MyCardDeleteActions;
    item: Submission;
  } | null>(null);
  const list = useMyCards(actions, filter);
  if (confirmNotice && list.loaded) setConfirmNotice(false);
  const body = useRef<ComponentRef<typeof ScrollView>>(null);
  const closed = useRef(false);
  const { cancel } = list;
  const back = useCallback(() => {
    if (closed.current) return;
    closed.current = true;
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
  return (
    <NightScreen
      background={require('../../../assets/images/my-cards/background.svg')}
    >
      <ScrollView ref={body} contentContainerStyle={styles.content}>
        <View style={styles.headingRow}>
          <Text accessibilityRole="header" style={styles.heading}>
            내 카드
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={onWrite ? '카드 쓰기' : '카드 쓰기 · 준비 중'}
            accessibilityState={{ disabled: !onWrite }}
            disabled={!onWrite}
            onPress={onWrite}
            style={[styles.write, !onWrite && styles.disabled]}
          >
            <Text style={styles.label}>+ 카드 쓰기</Text>
            {!onWrite && <Text style={styles.caption}>준비 중</Text>}
          </Pressable>
        </View>
        <View style={styles.filters} accessibilityRole="tablist">
          {filters.map(([value, label]) => (
            <Pressable
              key={value}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: filter === value }}
              onPress={() => setFilter(value)}
              style={[styles.filter, filter === value && styles.selected]}
            >
              <Text
                style={[styles.label, filter === value && styles.selectedLabel]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
        {confirmNotice && !list.loaded && (
          <View style={styles.panel}>
            <Text accessibilityLiveRegion="polite" style={styles.label}>
              {list.error === 'initial'
                ? '카드는 접수됐어요. 목록을 다시 불러와 주세요.'
                : '카드는 접수됐어요. 목록을 불러오고 있어요.'}
            </Text>
          </View>
        )}
        {!list.loaded && list.loading ? (
          <View style={styles.panel} accessibilityLiveRegion="polite">
            <ActivityIndicator color={theme.color.text} />
            <Text style={styles.label}>카드를 불러오고 있어요</Text>
          </View>
        ) : list.error === 'initial' ? (
          <View style={styles.panel}>
            <Notice
              title="카드 목록을 불러오지 못했어요"
              description="잠시 후 다시 시도해 주세요."
              error
            />
            <Button label="다시 불러오기" onPress={list.retry} />
          </View>
        ) : (
          <>
            {list.items.length === 0 ? (
              <View style={styles.panel}>
                <Notice
                  title={
                    list.loading
                      ? '카드 목록을 다시 확인하고 있어요'
                      : list.error === 'refresh'
                        ? '남은 카드를 확인해 주세요'
                        : list.hasMore
                          ? '이어서 불러올 카드가 있어요'
                          : filter === 'all'
                            ? '아직 쓴 카드가 없어요'
                            : filter === 'pending'
                              ? '검수 중인 카드가 없어요'
                              : '반려된 카드가 없어요'
                  }
                  description={
                    list.hasMore
                      ? '더 불러오기를 눌러 다음 카드를 확인해 주세요.'
                      : '작성한 카드와 검수 상태를 여기에서 확인할 수 있어요.'
                  }
                />
              </View>
            ) : (
              list.items.map((item) => (
                <SubmissionRow
                  key={item.id}
                  item={item}
                  onDelete={
                    deletions
                      ? () => setSelection({ source: actions, deletions, item })
                      : undefined
                  }
                />
              ))
            )}
            {list.error === 'refresh' ? (
              <View
                style={styles.panel}
                onLayout={(event) =>
                  body.current?.scrollTo({
                    y: event.nativeEvent.layout.y,
                    animated: false,
                  })
                }
              >
                <Notice
                  title="목록을 다시 확인하지 못했어요"
                  description="확인된 삭제는 유지했어요. 남은 카드를 다시 불러와 주세요."
                  error
                />
                <Button label="목록 다시 확인" onPress={list.retry} />
              </View>
            ) : list.error === 'more' ? (
              <View style={styles.panel}>
                <Notice
                  title="추가 카드를 불러오지 못했어요"
                  description="이미 불러온 카드는 그대로 있어요. 다시 불러와 주세요."
                  error
                />
                <Button label="추가 목록 다시 불러오기" onPress={list.retry} />
              </View>
            ) : list.hasMore ? (
              <Button
                label={list.loading ? '더 불러오는 중' : '더 불러오기'}
                onPress={list.loadMore}
                busy={list.loading}
              />
            ) : null}
          </>
        )}
        <Text style={styles.caption}>털실은 개수만 보여요</Text>
      </ScrollView>
      <View style={styles.navigation}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="홈으로 돌아가기"
          onPress={back}
          style={styles.navItem}
        >
          <View style={styles.navIcon} />
          <Text style={styles.caption}>홈</Text>
        </Pressable>
        <View
          accessibilityRole="tab"
          accessibilityLabel="내 카드"
          accessibilityState={{ selected: true }}
          style={styles.navItem}
        >
          <View style={styles.navIcon} />
          <Text style={styles.caption}>내 카드</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="설정 · 준비 중"
          accessibilityState={{ disabled: true }}
          disabled
          style={[styles.navItem, styles.disabled]}
        >
          <View style={styles.navIcon} />
          <Text style={styles.caption}>설정 · 준비 중</Text>
        </Pressable>
      </View>
      {selection &&
        selection.source === actions &&
        selection.deletions === deletions && (
          <CardDeleteDialog
            key={selection.item.id}
            item={selection.item}
            actions={selection.deletions}
            onCancel={() => setSelection(null)}
            onDeleted={() => {
              list.confirmDeleted(selection.item.id);
              setSelection(null);
            }}
          />
        )}
    </NightScreen>
  );
}
function SubmissionRow({
  item,
  onDelete,
}: {
  item: Submission;
  onDelete?: () => void;
}) {
  const badge = badges[item.moderation_status];
  const { fontScale } = useWindowDimensions();
  const title =
    item.kind === 'text'
      ? item.content.text
      : `${item.content.track.title} · ${item.content.track.artist}`;
  return (
    <View style={styles.panel}>
      <View style={styles.headingRow}>
        <View style={styles.kind}>
          <View
            style={[
              styles.kindDot,
              item.kind === 'song' && { backgroundColor: theme.color.primary },
            ]}
          />
          <Text style={styles.caption}>
            {item.kind === 'text' ? '짧은 글' : '노래 추천'}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: badge.color }]}>
          <Text style={styles.badgeText}>{badge.label}</Text>
        </View>
      </View>
      <Text
        style={styles.summary}
        numberOfLines={fontScale > 1.3 ? undefined : 2}
      >
        {title}
      </Text>
      <View style={styles.divider} />
      <Text style={styles.caption}>
        {date.format(new Date(item.created_at))} · 털실 {item.yarn_count}개
      </Text>
      {item.moderation_status === 'rejected' && (
        <View style={styles.reason}>
          <Text style={styles.reasonTitle}>반려 사유</Text>
          <Text style={styles.label}>
            {item.rejection_reason || '반려 사유를 확인하고 있어요.'}
          </Text>
        </View>
      )}
      {onDelete && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`카드 삭제: ${title}`}
          onPress={onDelete}
          style={styles.delete}
        >
          <Text style={[styles.caption, styles.deleteLabel]}>삭제</Text>
        </Pressable>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  content: { padding: 20, gap: 14, paddingBottom: 28 },
  headingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  heading: {
    fontFamily: theme.font,
    fontSize: 22,
    lineHeight: 34,
    fontWeight: '700',
    color: theme.color.text,
  },
  write: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#2B3591',
    minHeight: 48,
    justifyContent: 'center',
    boxShadow: '4px 4px 0 #0E1040',
  },
  label: {
    fontFamily: theme.font,
    fontSize: 13,
    lineHeight: 22,
    color: theme.color.text,
  },
  caption: {
    fontFamily: theme.font,
    fontSize: 11,
    lineHeight: 18,
    color: theme.color.muted,
  },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filter: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 48,
    justifyContent: 'center',
    backgroundColor: '#2B3591',
  },
  selected: {
    backgroundColor: theme.color.primary,
    boxShadow: '3px 3px 0 #8E6BC4',
  },
  selectedLabel: { color: theme.color.background },
  panel: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    backgroundColor: '#2B3591',
    boxShadow: '4px 4px 0 #0E1040',
  },
  kind: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  kindDot: { width: 6, height: 6, backgroundColor: theme.color.muted },
  badge: { paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: {
    fontFamily: theme.font,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    color: '#1E2063',
  },
  summary: {
    fontFamily: theme.font,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    color: theme.color.text,
  },
  divider: { height: 1, backgroundColor: '#3B4FB8' },
  reason: { gap: 6, paddingTop: 4 },
  reasonTitle: {
    fontFamily: theme.font,
    fontSize: 12,
    lineHeight: 20,
    fontWeight: '700',
    color: '#F9CFDD',
  },
  navigation: {
    flexDirection: 'row',
    paddingVertical: 8,
    minHeight: 64,
    backgroundColor: '#1B1C55',
    borderTopWidth: 1,
    borderTopColor: '#4A5BC2',
  },
  navItem: {
    flex: 1,
    paddingHorizontal: 6,
    minHeight: 48,
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIcon: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: '#4A55B8',
  },
  disabled: { opacity: 0.6 },
  delete: {
    minHeight: 48,
    minWidth: 48,
    alignSelf: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  deleteLabel: { textDecorationLine: 'underline' },
});

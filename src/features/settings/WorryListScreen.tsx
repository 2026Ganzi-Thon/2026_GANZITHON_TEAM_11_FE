import { useRef, useState, type ComponentRef } from 'react';
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
import { Image } from 'expo-image';
import { NightScreen } from '../../ui/NightScreen';
import { Button } from '../../ui/Button';
import { theme } from '../../ui/theme';
import { categories } from '../night/categories';
import { reflectionLabels } from '../morning/reflection';
import type { WorryListActions } from './types';
import { useWorryList } from './useWorryList';
import { Header } from './Header';
export function WorryListScreen(props: Parameters<typeof WorryListSession>[0]) {
  const [source, setSource] = useState({
    actions: props.actions,
    deletions: props.deletions,
    version: 0,
  });
  if (source.actions !== props.actions || source.deletions !== props.deletions)
    setSource({
      actions: props.actions,
      deletions: props.deletions,
      version: source.version + 1,
    });
  return <WorryListSession key={source.version} {...props} />;
}
function WorryListSession({
  actions,
  total,
  onBack,
  deletions,
  totalError = false,
  onRetryTotal,
}: {
  actions: WorryListActions;
  total: number | null;
  deletions?: WorryDeletions;
  totalError?: boolean;
  onRetryTotal?: () => void;
  onBack: () => void;
}) {
  const flow = useWorryList(actions, deletions);
  const [target, setTarget] = useState<{ id: string; date: string } | null>(
    null,
  );
  const [deletedDate, setDeletedDate] = useState<string | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  return (
    <NightScreen
      background={require('../../../assets/images/settings/worry-background.svg')}
    >
      <Header
        title="고민 기록"
        backLabel="설정으로 돌아가기"
        onBack={() => {
          flow.cancel();
          onBack();
        }}
      />
      <ScrollView ref={scroll} contentContainerStyle={styles.content}>
        {deletedDate && (
          <View style={styles.state}>
            <Text accessibilityLiveRegion="polite" style={styles.body}>
              {deletedDate} 고민을 지웠어요. 양과 카드는 그대로예요.
            </Text>
          </View>
        )}
        {total !== null ? (
          <Text style={styles.summary}>고민 기록 {total}개</Text>
        ) : totalError ? (
          <View style={styles.state}>
            <Text accessibilityRole="alert" style={styles.body}>
              기록 개수를 확인하지 못했어요.
            </Text>
            {onRetryTotal && (
              <Button label="기록 개수 다시 확인" onPress={onRetryTotal} />
            )}
          </View>
        ) : (
          <Text style={styles.summary}>기록 개수를 확인하고 있어요.</Text>
        )}
        {flow.items.map((item) => {
          const category = categories.find((c) => c.id === item.category_id)!;
          return (
            <View key={item.night_id} style={styles.record}>
              <View style={styles.metadata}>
                <Text style={styles.caption}>{item.night_date} 밤</Text>
                <View style={styles.category}>
                  <View
                    style={[styles.dot, { backgroundColor: category.color }]}
                  />
                  <Text style={styles.categoryText}>{category.label}</Text>
                </View>
              </View>
              <Text style={styles.body}>{item.worry_text}</Text>
              {item.reflection && (
                <Text style={styles.caption}>
                  아침에 돌아본 답 · {reflectionLabels[item.reflection.answer]}
                </Text>
              )}
              {deletions && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${item.night_date} 고민 삭제`}
                  onPress={() => {
                    setDeletedDate(null);
                    setTarget({ id: item.night_id, date: item.night_date });
                  }}
                  style={styles.remove}
                >
                  <Text style={styles.removeLabel}>고민 삭제</Text>
                </Pressable>
              )}
            </View>
          );
        })}
        {flow.loading && (
          <View style={styles.state}>
            <ActivityIndicator color={theme.color.primary} />
            <Text style={styles.summary}>
              {flow.loaded
                ? '기록을 더 불러오고 있어요.'
                : '고민 기록을 불러오고 있어요.'}
            </Text>
          </View>
        )}
        {flow.error && (
          <View style={styles.state}>
            <Text accessibilityRole="alert" style={styles.body}>
              {flow.error === 'more'
                ? '기록을 더 불러오지 못했어요. 앞의 기록은 그대로예요.'
                : flow.error === 'refresh'
                  ? '고민 목록을 새로 확인하지 못했어요. 삭제한 기록은 숨겼어요.'
                  : '고민 기록을 불러오지 못했어요.'}
            </Text>
            <Button
              label={
                flow.error === 'more'
                  ? '더 보기 다시 시도'
                  : flow.error === 'refresh'
                    ? '목록 다시 확인'
                    : '고민 기록 다시 불러오기'
              }
              onPress={flow.retry}
            />
          </View>
        )}
        {flow.loaded &&
          !flow.loading &&
          !flow.error &&
          flow.nextCursor === null &&
          !flow.items.length && (
            <View style={styles.state}>
              <Text style={styles.body}>저장된 고민 없음</Text>
              <Text style={styles.caption}>
                원문이 남아 있는 고민을 이곳에서 볼 수 있어요.
              </Text>
            </View>
          )}
        {!flow.error && flow.loaded && flow.nextCursor !== null && (
          <Button label="더 보기" busy={flow.loading} onPress={flow.loadMore} />
        )}
        <View style={styles.info}>
          <Image
            source={require('../../../assets/images/settings/info.svg')}
            style={{ width: 18, height: 18 }}
            accessible={false}
          />
          <Text style={styles.summary}>고민은 자동으로 지워지지 않아요.</Text>
        </View>
      </ScrollView>
      {target && deletions && (
        <WorryDeleteDialog
          source={deletions}
          nightId={target.id}
          nightDate={target.date}
          onCancel={() => setTarget(null)}
          onDeleted={() => {
            setDeletedDate(target.date);
            setTarget(null);
            scroll.current?.scrollTo({ y: 0, animated: false });
          }}
        />
      )}
    </NightScreen>
  );
}
const styles = StyleSheet.create({
  remove: {
    marginTop: 6,
    minHeight: 52,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9CFDD',
    boxShadow: '4px 4px 0 #C98AA3',
  },
  removeLabel: {
    fontFamily: theme.font,
    color: '#1E2063',
    fontSize: 15,
    lineHeight: 24,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 26,
    gap: 14,
    flexGrow: 1,
  },
  summary: {
    fontFamily: theme.font,
    color: theme.color.muted,
    fontSize: 13,
    lineHeight: 21,
    flexShrink: 1,
  },
  record: {
    backgroundColor: '#2B3591',
    padding: 14,
    gap: 8,
    boxShadow: '4px 4px 0 #0E1040',
  },
  metadata: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  caption: {
    fontFamily: theme.font,
    color: theme.color.muted,
    fontSize: 12,
    lineHeight: 20,
  },
  category: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#1E2063',
  },
  dot: { width: 6, height: 6 },
  categoryText: {
    fontFamily: theme.font,
    color: theme.color.text,
    fontSize: 11,
    lineHeight: 18,
  },
  body: {
    fontFamily: theme.font,
    color: theme.color.text,
    fontSize: 13,
    lineHeight: 21,
  },
  info: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingTop: 4,
  },
  state: { backgroundColor: '#1E2063', padding: 16, gap: 14 },
});

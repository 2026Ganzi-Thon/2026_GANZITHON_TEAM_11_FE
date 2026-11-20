import {
  useRef,
  useState,
  useEffect,
  useSyncExternalStore,
  type ComponentRef,
} from 'react';
import type { WorryDeletions } from '../worries/deletions';
import { WorryDeleteDialog } from '../worries/WorryDeleteDialog';
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
import { Image } from 'expo-image';
import { NightScreen } from '../../ui/NightScreen';
import { Button } from '../../ui/Button';
import { theme } from '../../ui/theme';
import { categories } from '../night/categories';
import { reflectionLabels } from '../morning/reflection';
import type { WorryListActions } from './types';
import { useWorryList } from './useWorryList';
import { Header } from './Header';
import { SelectedWorryDeleteDialog } from '../worries/SelectedWorryDeleteDialog';
import type { SelectionSnapshot } from '../worries/selectionDeletion';
const emptySelection: SelectionSnapshot = { items: [], pending: false };
const emptySubscribe = () => () => {};
const emptySnapshot = () => emptySelection;
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
  const { fontScale } = useWindowDimensions();
  const [target, setTarget] = useState<{ id: string; date: string } | null>(
    null,
  );
  const [deletedDate, setDeletedDate] = useState<string | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const batch = deletions?.records?.selection;
  const operation = useSyncExternalStore(
    batch?.subscribe ?? emptySubscribe,
    batch?.getSnapshot ?? emptySnapshot,
    batch?.getSnapshot ?? emptySnapshot,
  );
  const [selected, setSelected] = useState(new Set<string>()),
    [dialog, setDialog] = useState<string[] | null>(null),
    [toast, setToast] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const unresolved = operation.items.some((item) => item.status !== 'done');
  const ids = flow.items
    .filter((item) => selected.has(item.night_id))
    .map((item) => item.night_id);
  const goBack = () => {
    batch?.pause();
    flow.cancel();
    onBack();
  };
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });
    return () => sub.remove();
  });
  const confirm = async () => {
    if (!batch || !dialog) return;
    if (unresolved) await batch.retry();
    else await batch.start([...dialog]);
    if (!alive.current) return;
    const result = batch.getSnapshot();
    if (
      !result.pending &&
      result.items.length &&
      result.items.every((item) => item.status === 'done')
    ) {
      setToast(true);
      setDialog(null);
      setSelected(new Set());
      scroll.current?.scrollTo({ y: 0, animated: false });
    }
  };
  return (
    <NightScreen
      background={
        dialog
          ? require('../../../assets/images/settings/background.svg')
          : require('../../../assets/images/settings/worry-background.svg')
      }
    >
      <View
        style={{ flex: 1 }}
        accessibilityElementsHidden={!!dialog}
        importantForAccessibility={dialog ? 'no-hide-descendants' : 'auto'}
      >
        <Header
          title="고민 기록"
          backLabel="설정으로 돌아가기"
          onBack={goBack}
        />
        <ScrollView ref={scroll} contentContainerStyle={styles.content}>
          {toast && (
            <Text
              accessibilityLiveRegion="polite"
              style={[styles.body, styles.state]}
            >
              고민을 지웠어요
            </Text>
          )}
          {batch && flow.nextCursor && (
            <Text style={styles.caption}>
              더 보기를 누르면 나머지 기록도 선택할 수 있어요.
            </Text>
          )}
          {deletedDate && (
            <View style={styles.state}>
              <Text accessibilityLiveRegion="polite" style={styles.body}>
                {deletedDate} 고민을 지웠어요. 양과 카드는 그대로예요.
              </Text>
            </View>
          )}
          <View style={styles.summaryRow}>
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
            {batch && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  flow.items.length && ids.length === flow.items.length
                    ? '전체 선택 해제'
                    : '전체 선택'
                }
                accessibilityHint="현재 불러온 기록만 선택합니다."
                disabled={unresolved || operation.pending || !flow.items.length}
                onPress={() =>
                  setSelected(
                    ids.length === flow.items.length
                      ? new Set()
                      : new Set(flow.items.map((item) => item.night_id)),
                  )
                }
                hitSlop={10}
                style={styles.selectAll}
              >
                <Text style={styles.selectAllText}>
                  {flow.items.length && ids.length === flow.items.length
                    ? '전체 선택 해제'
                    : '전체 선택'}
                </Text>
              </Pressable>
            )}
          </View>
          {flow.items.map((item) => {
            const category = categories.find((c) => c.id === item.category_id)!;
            return (
              <Pressable
                key={item.night_id}
                accessibilityRole={batch ? 'checkbox' : undefined}
                accessibilityLabel={
                  batch ? `${item.night_date} 고민 선택` : undefined
                }
                accessibilityHint={batch ? item.worry_text : undefined}
                accessibilityState={
                  batch
                    ? {
                        checked: selected.has(item.night_id),
                        disabled: unresolved || operation.pending,
                      }
                    : undefined
                }
                disabled={!batch || unresolved || operation.pending}
                onPress={() =>
                  setSelected((previous) => {
                    const next = new Set(previous);
                    if (next.has(item.night_id)) next.delete(item.night_id);
                    else next.add(item.night_id);
                    return next;
                  })
                }
                style={[
                  styles.record,
                  batch && styles.selectable,
                  selected.has(item.night_id) && styles.selectedRecord,
                ]}
              >
                {batch && (
                  <View style={styles.checkbox}>
                    {selected.has(item.night_id) ? (
                      <Image
                        source={require('../../../assets/images/worry-selection/checked.svg')}
                        style={{
                          position: 'absolute',
                          left: -4,
                          top: -4,
                          width: 30,
                          height: 30,
                        }}
                        contentFit="contain"
                        accessible={false}
                      />
                    ) : (
                      <View style={styles.unchecked} />
                    )}
                  </View>
                )}
                <View style={batch ? styles.recordContent : undefined}>
                  <View style={styles.metadata}>
                    <Text
                      accessibilityLabel={`${item.night_date} 밤`}
                      style={styles.date}
                    >
                      {Number(item.night_date.slice(5, 7))}/
                      {Number(item.night_date.slice(8))} 밤
                    </Text>
                    <View style={styles.category}>
                      <View
                        style={[
                          styles.dot,
                          { backgroundColor: category.color },
                        ]}
                      />
                      <Text style={styles.categoryText}>{category.label}</Text>
                    </View>
                  </View>
                  <Text
                    numberOfLines={fontScale > 1 ? undefined : 1}
                    style={[styles.body, theme.contentText]}
                  >
                    {item.worry_text}
                  </Text>
                  {item.reflection && (
                    <View style={styles.reply}>
                      <Text style={styles.replyCaption}>아침에 돌아본 답</Text>
                      <View style={styles.replyBadge}>
                        <Text style={styles.replyText}>
                          {reflectionLabels[item.reflection.answer]}
                        </Text>
                      </View>
                    </View>
                  )}
                  {deletions && !batch && (
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
              </Pressable>
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
            <Button
              label="더 보기"
              busy={flow.loading}
              onPress={flow.loadMore}
            />
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
        {batch && (
          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                unresolved
                  ? '삭제 결과 다시 확인'
                  : `선택한 ${ids.length}개 지우기`
              }
              accessibilityState={{
                disabled: operation.pending || (!unresolved && !ids.length),
              }}
              disabled={operation.pending || (!unresolved && !ids.length)}
              onPress={() => {
                setToast(false);
                setDialog(
                  unresolved
                    ? operation.items.map((item) => item.nightId)
                    : [...ids],
                );
              }}
              style={[
                styles.remove,
                !unresolved && !ids.length && { opacity: 0.55 },
              ]}
            >
              <Text style={styles.removeLabel}>
                {unresolved
                  ? '삭제 결과 다시 확인'
                  : `선택한 ${ids.length}개 지우기`}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
      {dialog && batch && (
        <SelectedWorryDeleteDialog
          count={dialog.length}
          state={operation}
          onConfirm={() => void confirm()}
          onCancel={() => {
            if (operation.pending) return;
            if (!operation.items.some((item) => item.status === 'unknown'))
              batch.reset();
            setDialog(null);
          }}
        />
      )}
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
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  selectAll: { minHeight: 24, justifyContent: 'center' },
  date: {
    fontFamily: theme.font,
    color: '#C3C9F0',
    fontSize: 14,
    lineHeight: 21,
  },
  reply: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  replyCaption: {
    fontFamily: theme.font,
    color: '#C3C9F0',
    fontSize: 14,
    lineHeight: 21,
  },
  replyBadge: {
    backgroundColor: '#FFE7A3',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  replyText: {
    fontFamily: theme.font,
    color: '#1E2063',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
  },
  selectAllText: {
    fontFamily: theme.font,
    fontSize: 14,
    lineHeight: 22,
    color: '#D6A8FF',
    fontWeight: '700',
  },
  selectable: {
    flexDirection: 'row',
    gap: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedRecord: {
    backgroundColor: '#3A3F9E',
    borderColor: '#D6A8FF',
    boxShadow: '4px 4px 0 #8E6BC4',
  },
  checkbox: { width: 22, height: 22 },
  unchecked: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: '#4A5BC2',
    backgroundColor: '#1E2063',
  },
  recordContent: { flex: 1, gap: 6 },
  footer: { paddingHorizontal: 20, paddingBottom: 26, paddingTop: 10 },
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
    fontSize: 18,
    lineHeight: 27,
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
    fontSize: 16,
    lineHeight: 24,
    flexShrink: 1,
  },
  record: {
    backgroundColor: '#2B3591',
    minHeight: 95,
    padding: 12,
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
    fontSize: 14,
    lineHeight: 22,
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
    fontSize: 14,
    lineHeight: 21,
  },
  body: {
    fontFamily: theme.font,
    color: theme.color.text,
    fontSize: 16,
    lineHeight: 24,
  },
  info: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingTop: 4,
  },
  state: { backgroundColor: '#1E2063', padding: 16, gap: 14 },
});

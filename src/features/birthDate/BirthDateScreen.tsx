import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { NightScreen } from '../../ui/NightScreen';
import { Button } from '../../ui/Button';
import { theme } from '../../ui/theme';
import { zodiacNames } from '../fortune/types';
import { DateWheel } from './DateWheel';
import { formatDate, parseDate } from './date';
import type { BirthDateActions } from './types';
import { useBirthDate } from './useBirthDate';
function dateLabel(value: string | null) {
  const date = value ? parseDate(value) : null;
  return date ? `${date.year}년 ${date.month}월 ${date.day}일` : '';
}
export function BirthDateScreen(props: {
  actions: BirthDateActions;
  onBack: () => void;
}) {
  const [source, setSource] = useState({ actions: props.actions, version: 0 });
  if (source.actions !== props.actions)
    setSource({ actions: props.actions, version: source.version + 1 });
  return <BirthDateSession key={source.version} {...props} />;
}
function BirthDateSession({
  actions,
  onBack,
}: {
  actions: BirthDateActions;
  onBack: () => void;
}) {
  const flow = useBirthDate(actions, onBack);
  const { back } = flow;
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      back();
      return true;
    });
    return () => sub.remove();
  }, [back]);
  const { phase, snapshot, draft, result } = flow;
  const busy = phase === 'saving';
  return (
    <NightScreen
      background={require('../../../assets/images/birth-date/background.svg')}
    >
      <StatusBar style="light" />
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="생년월일 변경 닫기"
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={back}
          style={styles.back}
        >
          <Text style={styles.arrow}>←</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.headerTitle}>
          생년월일 수정
        </Text>
      </View>
      <ScrollView
        key={`${phase}:${flow.revision}`}
        contentContainerStyle={styles.content}
      >
        {phase === 'loading' || phase === 'conflict' ? (
          <View style={styles.panel}>
            <ActivityIndicator color={theme.color.primary} />
            <Text style={styles.body}>
              {phase === 'conflict'
                ? '최신 변경 상태를 확인하고 있어요.'
                : '생년월일을 불러오고 있어요.'}
            </Text>
          </View>
        ) : phase === 'load-error' ? (
          <View style={styles.panel}>
            <Text accessibilityRole="alert" style={styles.body}>
              생년월일을 불러오지 못했어요.
            </Text>
            <Button label="다시 불러오기" onPress={flow.retryLoad} />
          </View>
        ) : phase === 'conflict-error' ? (
          <View style={styles.panel}>
            <Text accessibilityRole="alert" style={styles.body}>
              최신 변경 상태를 확인하지 못했어요.
            </Text>
            <Text style={styles.caption}>
              선택한 날짜는 {dateLabel(flow.target)}이에요. 다시 보내기 전에
              등록된 생일을 확인해 주세요.
            </Text>
            <Button
              label="변경 상태 다시 확인"
              onPress={() => void flow.reconcile()}
            />
          </View>
        ) : phase === 'saved' && result ? (
          <View style={styles.panel}>
            <Text
              accessibilityRole="header"
              accessibilityLiveRegion="polite"
              style={styles.heading}
            >
              생년월일을 변경했어요.
            </Text>
            <Text style={styles.body}>{dateLabel(result.birth_date)}</Text>
            <Text style={styles.body}>{zodiacNames[result.zodiac]}</Text>
            <Text style={styles.caption}>
              남은 수정 {result.edits_remaining}회
            </Text>
            <Button label="돌아가기" onPress={back} />
          </View>
        ) : phase === 'conflict-result' && snapshot ? (
          <View style={styles.panel}>
            <Text accessibilityRole="header" style={styles.heading}>
              변경 가능한 횟수를 확인했어요.
            </Text>
            <Text style={styles.body}>선택한 생일을 저장하지 못했어요.</Text>
            <Text style={styles.caption}>현재 등록된 생일</Text>
            <Text style={styles.body}>{dateLabel(snapshot.birth_date)}</Text>
            <Text style={styles.caption}>
              남은 수정 {snapshot.edits_remaining}회
            </Text>
            <Button label="돌아가기" onPress={back} />
          </View>
        ) : phase === 'confirm' ||
          phase === 'saving' ||
          phase === 'uncertain' ? (
          <>
            <View style={styles.panel}>
              <Text accessibilityRole="header" style={styles.heading}>
                {phase === 'uncertain'
                  ? '변경 결과를 확인하지 못했어요'
                  : busy
                    ? '생년월일을 변경하고 있어요.'
                    : '이 생일로 바꿀까요?'}
              </Text>
              <Text style={styles.body}>{dateLabel(flow.target)}</Text>
              <Text style={styles.caption}>
                {phase === 'uncertain'
                  ? '다른 날짜로 바꾸기 전에 같은 생년월일로 다시 확인해 주세요.'
                  : '한 번 바꾸면 다시는 바꿀 수 없어요.'}
              </Text>
            </View>
            <View style={styles.spacer} />
            <Button
              label={
                busy
                  ? '변경 확인 중'
                  : phase === 'uncertain'
                    ? '같은 날짜로 다시 확인'
                    : '이 생일로 변경하기'
              }
              busy={busy}
              onPress={() => void flow.save()}
            />
            {phase === 'confirm' && (
              <Button label="계속 선택하기" onPress={flow.edit} />
            )}
          </>
        ) : snapshot && draft ? (
          <>
            <Text accessibilityRole="header" style={styles.heading}>
              {snapshot.edits_remaining
                ? '생일을 바꿀까요?'
                : '등록된 생일이에요'}
            </Text>
            <Text style={styles.body}>
              {snapshot.edits_remaining
                ? '한 번 바꾸면 다시는 바꿀 수 없어요'
                : '수정 가능한 횟수를 모두 사용했어요.'}
            </Text>
            <View style={styles.metadata}>
              <Text style={styles.caption}>
                현재 생년월일 · {dateLabel(snapshot.birth_date)}
              </Text>
              <Text style={styles.caption}>
                남은 수정 {snapshot.edits_remaining}회
              </Text>
            </View>
            {flow.message && (
              <View style={styles.panel}>
                <Text accessibilityRole="alert" style={styles.error}>
                  {flow.message}
                </Text>
              </View>
            )}
            <DateWheel
              value={draft}
              todayYear={parseDate(snapshot.today)!.year}
              disabled={!snapshot.edits_remaining}
              onChange={flow.change}
            />
            <View style={styles.bubbleRow}>
              <Image
                source={require('../../../assets/images/birth-date/sheep.svg')}
                style={{ width: 42.0001, height: 35 }}
                accessible={false}
              />
              <View style={styles.bubble}>
                <Text style={styles.body}>
                  {formatDate(draft) === snapshot.birth_date
                    ? `${draft.month}월 ${draft.day}일이면 ${zodiacNames[snapshot.zodiac]}네!`
                    : `선택한 생일은 ${draft.month}월 ${draft.day}일이야.`}
                </Text>
              </View>
            </View>
            <Text style={styles.caption}>
              {snapshot.edits_remaining
                ? '저장한 뒤 별자리를 다시 확인할게요.'
                : '등록된 생일의 별자리예요.'}
            </Text>
            <View style={styles.spacer} />
            <Button
              label={
                snapshot.edits_remaining
                  ? '한 번만 바꿀 수 있어요!'
                  : '변경할 수 없어요'
              }
              disabled={
                !snapshot.edits_remaining ||
                formatDate(draft) === snapshot.birth_date
              }
              onPress={flow.confirm}
            />
          </>
        ) : null}
      </ScrollView>
    </NightScreen>
  );
}
const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
    gap: 12,
  },
  back: { minWidth: 40, minHeight: 48, justifyContent: 'center' },
  arrow: { fontSize: 24, color: theme.color.text },
  headerTitle: {
    fontFamily: theme.font,
    fontSize: 16,
    lineHeight: 24,
    color: theme.color.text,
    fontWeight: '700',
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 14,
  },
  heading: {
    fontFamily: theme.font,
    color: theme.color.text,
    fontSize: 22,
    lineHeight: 32,
    fontWeight: '700',
  },
  body: {
    fontFamily: theme.font,
    color: theme.color.text,
    fontSize: 14,
    lineHeight: 22,
  },
  caption: {
    fontFamily: theme.font,
    color: theme.color.muted,
    fontSize: 12,
    lineHeight: 20,
  },
  panel: { backgroundColor: '#1E2063', padding: 16, gap: 14, borderRadius: 4 },
  metadata: {
    backgroundColor: '#1E2063',
    padding: 12,
    gap: 8,
    borderRadius: 4,
  },
  error: {
    fontFamily: theme.font,
    color: theme.color.error,
    fontSize: 14,
    lineHeight: 22,
  },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bubble: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: '#3346AE',
    borderRadius: 4,
  },
  spacer: { flex: 1, minHeight: 12 },
});

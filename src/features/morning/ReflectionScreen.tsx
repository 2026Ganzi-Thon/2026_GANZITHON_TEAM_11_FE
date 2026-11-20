import { useState } from 'react';
import type { WorryDeletions } from '../worries/deletions';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { DayScreen } from './DayScreen';
import { theme } from '../../ui/theme';
import { reflectionLabels, type ReflectionActions } from './reflection';
import type { ReflectionAnswer } from '../flock/types';
import { useReflection } from './useReflection';
function timeLabel(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return '';
  return (
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Seoul',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(value)) + ' · '
  );
}
export function ReflectionScreen(
  props: Parameters<typeof ReflectionSession>[0],
) {
  const [source, setSource] = useState({
    id: props.nightId,
    actions: props.actions,
    worries: props.worries,
    version: 0,
  });
  if (
    source.id !== props.nightId ||
    source.actions !== props.actions ||
    source.worries !== props.worries
  ) {
    setSource({
      id: props.nightId,
      actions: props.actions,
      worries: props.worries,
      version: source.version + 1,
    });
  }
  return <ReflectionSession key={source.version} {...props} />;
}
function ReflectionSession({
  nightId,
  actions,
  onBack,
  worries,
}: {
  nightId: string;
  actions: ReflectionActions;
  onBack: () => void;
  worries?: WorryDeletions;
}) {
  const flow = useReflection(nightId, actions, onBack, worries);
  const night = flow.record?.night;
  const reflection =
    flow.phase === 'ready' && night && night.category_id !== 'none'
      ? flow.record?.reflection
      : null;
  const completed = flow.available && flow.saved && !!reflection;
  const matchingReply =
    reflection?.answer === flow.selected ? reflection : null;
  const dirty = !!flow.selected && flow.selected !== reflection?.answer;
  const { width } = useWindowDimensions();
  const scale = Math.min(width, 480) / 360;
  const choices: ReflectionAnswer[] = [
    'same',
    'smaller',
    'much_better',
    'new_worry',
    'cannot_recall',
  ];
  // Keep an older saved answer readable without changing its API value.
  if (reflection?.answer === 'bigger') choices.push('bigger');
  const labels: Partial<Record<ReflectionAnswer, string>> = {
    much_better: '생각보다\n괜찮아요',
    new_worry: '다른 고민이\n생겼어요',
    cannot_recall: '기억이\n잘 안 나요',
  };
  return (
    <DayScreen>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="양떼로 돌아가기"
          onPress={flow.back}
          style={styles.back}
        >
          <Text style={styles.arrow}>←</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.heading}>
          어젯밤 돌아보기
        </Text>
      </View>
      <ScrollView
        key={completed ? 'result' : 'form'}
        contentContainerStyle={styles.content}
      >
        {flow.phase === 'loading' ? (
          <View style={styles.panel}>
            <ActivityIndicator color="#2F3A9E" />
            <Text style={styles.text}>지난밤 기록을 불러오고 있어요.</Text>
          </View>
        ) : flow.phase === 'error' ? (
          <View style={styles.panel}>
            <Text accessibilityRole="alert" style={styles.text}>
              기록을 불러오지 못했어요.
            </Text>
            <Action label="다시 불러오기" onPress={flow.retry} />
          </View>
        ) : flow.phase === 'blocked' ? (
          <View style={styles.panel}>
            <Text accessibilityRole="alert" style={styles.text}>
              지금은 이 회고를 남길 수 없어요.
            </Text>
          </View>
        ) : !flow.available ? (
          <View style={styles.panel}>
            <Text style={styles.text}>
              {night?.category_id === 'none'
                ? '고민 없이 쉬어 간 밤이에요.'
                : '남아 있는 고민 기록이 없어요.'}
            </Text>
            {reflection && (
              <View style={styles.reply}>
                <Text style={styles.text}>
                  저장된 회고 · {reflectionLabels[reflection.answer]}
                </Text>
                <Text style={styles.message}>{reflection.message}</Text>
                <Text style={styles.text}>
                  고민 원문이 없어 새 회고는 남길 수 없어요.
                </Text>
              </View>
            )}
          </View>
        ) : (
          <>
            <View style={styles.note}>
              <Image
                source={require('../../../assets/images/reflection/note.svg')}
                contentFit="fill"
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.tape} />
              <Text style={styles.caption}>
                어젯밤 {timeLabel(night!.worry_saved_at)}
                {night!.entrusted ? '맡긴 걱정' : '지난밤 걱정'}
              </Text>
              <Text style={[styles.text, theme.contentText]}>
                {night!.worry_text}
              </Text>
            </View>
            <Text accessibilityRole="header" style={styles.question}>
              이 걱정, 지금은 어때요?
            </Text>
            <View style={styles.character}>
              <View style={styles.bubbleSpace}>
                {matchingReply && (
                  <View style={styles.bubble}>
                    <Text
                      accessibilityLiveRegion="polite"
                      style={styles.message}
                    >
                      {matchingReply.message}
                    </Text>
                    <View style={styles.tail} />
                  </View>
                )}
              </View>
              <Image
                source={require('../../../assets/images/reflection/face.svg')}
                style={[
                  styles.face,
                  { width: 114.545 * scale, height: 98.182 * scale },
                ]}
                contentFit="contain"
                accessibilityIgnoresInvertColors
              />
              <Text style={styles.answer}>
                {flow.selected
                  ? reflectionLabels[flow.selected]
                  : '마음을 골라 주세요'}
              </Text>
            </View>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel="걱정 돌아보기 선택"
              style={styles.choices}
            >
              <View pointerEvents="none" style={styles.path}>
                {Array.from({ length: 16 }, (_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      { top: Math.sin((i / 15) * Math.PI) * 22 },
                    ]}
                  />
                ))}
              </View>
              {choices.map((answer, index) => {
                const selected = flow.selected === answer;
                return (
                  <Pressable
                    key={answer}
                    accessibilityRole="radio"
                    accessibilityLabel={reflectionLabels[answer]}
                    accessibilityState={{
                      checked: selected,
                      disabled: flow.busy,
                    }}
                    disabled={flow.busy}
                    onPress={() => flow.select(answer)}
                    style={[
                      styles.choice,
                      { paddingTop: [0, 17, 26, 20, 0, 0][index] },
                    ]}
                  >
                    <View style={[styles.square, selected && styles.selected]}>
                      {selected && <View style={styles.selectedDot} />}
                    </View>
                    <Text
                      style={[
                        styles.choiceLabel,
                        selected && styles.selectedLabel,
                      ]}
                    >
                      {labels[answer] ?? reflectionLabels[answer]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {flow.failure && (
              <Text accessibilityRole="alert" style={styles.notice}>
                저장하지 못했어요. 선택은 그대로예요. 다시 시도해 주세요.
              </Text>
            )}
            {flow.busy && (
              <ActivityIndicator
                accessibilityLabel="회고 저장 중"
                color="#2F3A9E"
              />
            )}
            {dirty && !flow.busy && (
              <Text accessibilityLiveRegion="polite" style={styles.notice}>
                아직 저장하지 않은 선택이에요.
              </Text>
            )}
            <View style={styles.spacer} />
            {dirty && (
              <Action
                label="회고 저장하기"
                disabled={flow.busy}
                onPress={() => void flow.save()}
              />
            )}
          </>
        )}
        <Action
          label="양떼 보러 가기"
          disabled={flow.busy}
          onPress={flow.back}
        />
      </ScrollView>
    </DayScreen>
  );
}
function Action({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.action, disabled && { opacity: 0.5 }]}
    >
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    minHeight: 52,
  },
  back: { minWidth: 40, minHeight: 48, justifyContent: 'center' },
  arrow: { fontSize: 24, color: '#242565' },
  heading: {
    fontFamily: theme.font,
    fontSize: 18,
    lineHeight: 27,
    fontWeight: '700',
    color: '#242565',
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
    paddingBottom: 32,
    flexGrow: 1,
  },
  text: {
    fontFamily: theme.font,
    fontSize: 16,
    lineHeight: 25,
    color: '#2F3A9E',
  },
  caption: {
    fontFamily: theme.font,
    fontSize: 14,
    lineHeight: 21,
    color: '#5B6BC8',
  },
  note: {
    padding: 16,
    gap: 8,
    backgroundColor: '#FFF5D4',
    minHeight: 84,
    boxShadow: '4px 4px 0 #AFC0FF',
  },
  tape: {
    position: 'absolute',
    top: -6,
    width: 40,
    height: 12,
    backgroundColor: '#D6A8FF',
    alignSelf: 'center',
  },
  reply: { gap: 8 },
  panel: { backgroundColor: '#FFFFFF', padding: 16, gap: 16 },
  question: {
    fontFamily: theme.font,
    fontSize: 24,
    lineHeight: 36,
    fontWeight: '700',
    textAlign: 'center',
    color: '#2F3A9E',
  },
  character: { alignItems: 'center', gap: 12 },
  bubbleSpace: {
    width: '100%',
    minHeight: 48,
    alignItems: 'flex-end',
    paddingBottom: 14,
  },
  bubble: {
    maxWidth: '88%',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#2F3A9E',
    boxShadow: '3px 3px 0 #AFC0FF',
  },
  message: {
    fontFamily: theme.font,
    fontSize: 14,
    lineHeight: 23,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: '#2F3A9E',
  },
  tail: {
    position: 'absolute',
    bottom: -8,
    left: 6,
    width: 8,
    height: 8,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#2F3A9E',
    backgroundColor: '#FFFFFF',
  },
  face: { alignSelf: 'center' },
  answer: {
    fontFamily: theme.font,
    fontSize: 20,
    lineHeight: 30,
    fontWeight: '700',
    color: '#2F3A9E',
    textAlign: 'center',
  },
  choices: {
    flexDirection: 'row',
    minHeight: 130,
    marginHorizontal: -12,
    marginTop: 8,
  },
  path: {
    position: 'absolute',
    top: 14,
    left: '8%',
    right: '8%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dot: { width: 6, height: 4, backgroundColor: '#AFC0FF' },
  choice: { flex: 1, alignItems: 'center', gap: 8, minHeight: 48 },
  square: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#2F3A9E',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: {
    width: 26,
    height: 26,
    backgroundColor: '#FFE7A3',
    boxShadow: '3px 3px 0 #D9B65E',
  },
  selectedDot: { width: 8, height: 8, backgroundColor: '#2F3A9E' },
  choiceLabel: {
    fontFamily: theme.font,
    fontSize: 14,
    lineHeight: 21,
    color: '#4A5290',
    textAlign: 'center',
  },
  selectedLabel: { color: '#2F3A9E', fontWeight: '700' },
  notice: {
    fontFamily: theme.font,
    fontSize: 16,
    lineHeight: 25,
    color: '#2F3A9E',
    padding: 12,
    backgroundColor: '#E6EBFF',
  },
  spacer: { flex: 1, minHeight: 24 },
  action: {
    padding: 14,
    minHeight: 52,
    backgroundColor: '#FFE7A3',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '5px 5px 0 #D9B65E',
  },
  actionText: {
    fontFamily: theme.font,
    fontSize: 18,
    lineHeight: 27,
    fontWeight: '700',
    color: '#2F3A9E',
    textAlign: 'center',
  },
});

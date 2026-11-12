import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
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
export function ReflectionScreen({
  nightId,
  actions,
  onBack,
}: {
  nightId: string;
  actions: ReflectionActions;
  onBack: () => void;
}) {
  const flow = useReflection(nightId, actions, onBack);
  const night = flow.record?.night;
  const reflection = flow.available ? flow.record?.reflection : null;
  const completed = flow.saved && !!reflection;
  const matchingReply =
    reflection?.answer === flow.selected ? reflection : null;
  const dirty = !!flow.selected && flow.selected !== reflection?.answer;
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
        {completed && reflection ? (
          <View style={styles.panel}>
            <Text
              accessibilityRole="header"
              accessibilityLiveRegion="polite"
              style={styles.question}
            >
              회고를 저장했어요.
            </Text>
            <Text style={styles.text}>
              저장한 회고 · {reflectionLabels[reflection.answer]}
            </Text>
            <Text style={styles.message}>{reflection.message}</Text>
            <Image
              source={require('../../../assets/images/reflection/face.svg')}
              style={styles.face}
              contentFit="contain"
              accessibilityIgnoresInvertColors
            />
            <Action label="회고 다시 선택하기" onPress={flow.edit} />
          </View>
        ) : flow.phase === 'loading' ? (
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
                {night!.night_date} 밤 · {timeLabel(night!.worry_saved_at)}
                {night!.entrusted ? '맡긴 걱정' : '지난밤 걱정'}
              </Text>
              <Text style={styles.text}>{night!.worry_text}</Text>
            </View>
            <View style={styles.panel}>
              <Text accessibilityRole="header" style={styles.question}>
                이 걱정, 지금은 어때요?
              </Text>
              {matchingReply && (
                <View style={styles.reply}>
                  <Text style={styles.text}>
                    저장된 회고 · {reflectionLabels[matchingReply.answer]}
                  </Text>
                  <Text style={styles.message}>{matchingReply.message}</Text>
                </View>
              )}
              <Image
                source={require('../../../assets/images/reflection/face.svg')}
                style={styles.face}
                contentFit="contain"
                accessibilityIgnoresInvertColors
              />
              <View
                accessibilityRole="radiogroup"
                accessibilityLabel="걱정 돌아보기 선택"
              >
                {(Object.keys(reflectionLabels) as ReflectionAnswer[]).map(
                  (answer) => (
                    <Pressable
                      key={answer}
                      accessibilityRole="radio"
                      accessibilityLabel={reflectionLabels[answer]}
                      accessibilityState={{
                        checked: flow.selected === answer,
                        disabled: flow.busy,
                      }}
                      disabled={flow.busy}
                      onPress={() => flow.select(answer)}
                      style={[
                        styles.choice,
                        flow.selected === answer && styles.selected,
                      ]}
                    >
                      <Text style={styles.text}>
                        {flow.selected === answer ? '▣' : '□'}{' '}
                        {reflectionLabels[answer]}
                      </Text>
                    </Pressable>
                  ),
                )}
              </View>
              {flow.failure && (
                <Text accessibilityRole="alert" style={styles.text}>
                  저장하지 못했어요. 선택은 그대로예요. 다시 시도해 주세요.
                </Text>
              )}
              {dirty && (
                <Text accessibilityLiveRegion="polite" style={styles.text}>
                  아직 저장하지 않은 선택이에요.
                </Text>
              )}
              {flow.busy && (
                <ActivityIndicator
                  accessibilityLabel="회고 저장 중"
                  color="#2F3A9E"
                />
              )}
              <Action
                label="회고 저장하기"
                disabled={
                  flow.busy ||
                  !flow.selected ||
                  flow.selected === flow.record?.reflection?.answer
                }
                onPress={() => void flow.save()}
              />
            </View>
          </>
        )}
        <Action
          label={
            flow.saved || flow.record?.reflection
              ? '양떼 보러 가기'
              : '건너뛰고 양떼 보기'
          }
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
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    color: '#242565',
    flex: 1,
  },
  content: { padding: 20, gap: 24, paddingBottom: 32, flexGrow: 1 },
  text: {
    fontFamily: theme.font,
    fontSize: 13,
    lineHeight: 22,
    color: '#2F3A9E',
  },
  caption: {
    fontFamily: theme.font,
    fontSize: 10,
    lineHeight: 17,
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
    fontSize: 20,
    lineHeight: 30,
    fontWeight: '700',
    textAlign: 'center',
    color: '#2F3A9E',
  },
  message: {
    fontFamily: theme.font,
    fontSize: 12,
    lineHeight: 21,
    padding: 12,
    borderWidth: 2,
    borderColor: '#2F3A9E',
    color: '#2F3A9E',
  },
  face: { width: 114.545, height: 98.182, alignSelf: 'center' },
  choice: {
    padding: 12,
    minHeight: 48,
    borderWidth: 2,
    borderColor: '#2F3A9E',
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
  },
  selected: { backgroundColor: '#FFE7A3' },
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
    fontSize: 15,
    lineHeight: 24,
    fontWeight: '700',
    color: '#2F3A9E',
    textAlign: 'center',
  },
});

import { useEffect } from 'react';
import {
  BackHandler,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button } from '../../ui/Button';
import { NightScreen } from '../../ui/NightScreen';
import { theme } from '../../ui/theme';
import { categories } from '../night/categories';
import { TextCardArtwork } from './TextCardArtwork';
import { PREVIEW_TEXT_CARD_LIMIT, type TextCardActions } from './types';
import { useTextCardWriting } from './useTextCardWriting';
function fieldMessage(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value))
    return (
      value
        .filter((item): item is string => typeof item === 'string')
        .join('\n') || null
    );
  return null;
}
export function TextCardScreen({
  actions,
  sourceNightId,
  onBack,
  onDone,
  modal = false,
  externalCategory = false,
  completionLabel = '이제 잘게요',
}: {
  actions: TextCardActions;
  sourceNightId: string;
  onBack: () => void;
  onDone: () => void;
  modal?: boolean;
  externalCategory?: boolean;
  completionLabel?: string;
}) {
  const flow = useTextCardWriting(
    actions,
    sourceNightId,
    onBack,
    onDone,
    externalCategory,
  );
  const { draft, step, error, pending, back } = flow;
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      back();
      return true;
    });
    return () => sub.remove();
  }, [back]);
  const category = categories.find((item) => item.id === draft.category_id);
  const textError = fieldMessage(error?.fields?.['content.text']);
  const categoryError = fieldMessage(error?.fields?.category_id);
  const conflict =
    error?.code === 'WRITING_ENTRY_REQUIRED' ||
    error?.code === 'IDEMPOTENCY_CONFLICT';
  const content = (
    <NightScreen
      background={require('../../../assets/images/text-card/night.svg')}
    >
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          key={step}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          {step !== 'complete' && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="이전"
              onPress={flow.back}
              style={styles.back}
            >
              <Text style={styles.link}>〈 이전</Text>
            </Pressable>
          )}
          <Text style={styles.preview}>미리보기 · 서버 전송 안 함</Text>
          {step === 'complete' ? (
            <>
              <TextCardArtwork />
              <View style={styles.panel}>
                <Text style={styles.title} accessibilityRole="header">
                  카드를 맡겼어요
                </Text>
                <Text style={styles.body}>검수를 기다리고 있어요.</Text>
                <Text style={styles.body}>
                  승인된 뒤에 다른 사람에게 보여요.
                </Text>
                <Text style={styles.hint}>
                  지금은 예시 응답으로 접수 과정을 확인했어요. 실제 카드는
                  전송되지 않았어요.
                </Text>
              </View>
              <Button label={completionLabel} onPress={onDone} />
            </>
          ) : step === 'support' ? (
            <>
              <View style={styles.panel}>
                <Text style={styles.title} accessibilityRole="header">
                  제출을 잠시 멈췄어요
                </Text>
                <Text style={styles.body}>
                  {error?.serverMessage ?? '지금은 잠시 쉬어 가도 괜찮아요.'}
                </Text>
                <Text style={styles.hint}>
                  쓰던 글은 이 시연 안에 남아 있어요. 도움 안내는 예시이며 실제
                  안전 검사와 연결되지 않았어요.
                </Text>
              </View>
              <Button label="쓰던 글로 돌아가기" onPress={flow.returnToDraft} />
            </>
          ) : step === 'category' ? (
            <>
              <View style={styles.panel}>
                <Text style={styles.title} accessibilityRole="header">
                  누구에게 보내고 싶나요?
                </Text>
                <Text style={styles.body}>
                  비슷한 고민을 가진 누군가에게 짧은 글을 남겨 주세요.
                </Text>
              </View>
              <View style={styles.panel}>
                <Text style={styles.section} accessibilityRole="header">
                  고민 분류
                </Text>
                <View style={styles.chips}>
                  {categories
                    .filter((item) => item.id !== 'none')
                    .map((item) => (
                      <Pressable
                        key={item.id}
                        accessibilityRole="radio"
                        accessibilityLabel={item.label}
                        accessibilityState={{
                          checked: draft.category_id === item.id,
                        }}
                        onPress={() =>
                          flow.update({
                            category_id: item.id as Exclude<
                              typeof item.id,
                              'none'
                            >,
                          })
                        }
                        style={[
                          styles.chip,
                          draft.category_id === item.id && styles.selected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipLabel,
                            draft.category_id === item.id &&
                              styles.selectedLabel,
                          ]}
                        >
                          {item.label}
                        </Text>
                      </Pressable>
                    ))}
                </View>
              </View>
              <Button
                label="다음"
                disabled={!draft.category_id}
                onPress={flow.next}
              />
            </>
          ) : (
            <>
              <View style={styles.panel}>
                <Text style={styles.title} accessibilityRole="header">
                  짧은 글 남기기
                </Text>
                <Text style={styles.body}>
                  {category?.label} 고민을 가진 누군가에게
                </Text>
              </View>
              <View style={styles.panel}>
                <TextInput
                  accessibilityLabel="짧은 글"
                  multiline
                  editable={!pending}
                  value={draft.text}
                  onChangeText={(text) => flow.update({ text })}
                  placeholder="오늘의 나처럼 잠 못 드는 누군가에게"
                  placeholderTextColor={theme.color.muted}
                  style={styles.input}
                  textAlignVertical="top"
                  scrollEnabled
                />
                <Text
                  style={[
                    styles.counter,
                    flow.length > PREVIEW_TEXT_CARD_LIMIT && styles.error,
                  ]}
                  accessibilityLiveRegion="polite"
                >
                  {flow.length} / {PREVIEW_TEXT_CARD_LIMIT}
                </Text>
                {!!textError && (
                  <Text style={styles.error} accessibilityRole="alert">
                    {textError}
                  </Text>
                )}
                <Text style={styles.hint}>
                  내 말로 적어 주세요. 다른 사람의 문장을 인용한다면 출처도 함께
                  남겨 주세요.
                </Text>
                <Text style={styles.hint}>
                  앞뒤 공백을 제외한 200자는 미리보기 임시 기준이에요.
                </Text>
              </View>
              {!!categoryError && (
                <Text
                  style={[styles.panel, styles.error]}
                  accessibilityRole="alert"
                >
                  {categoryError}
                </Text>
              )}
              {error && step === 'write' && !textError && !categoryError && (
                <View style={styles.panel} accessibilityRole="alert">
                  <Text style={styles.section}>
                    {conflict
                      ? '작성할 수 있는 밤을 확인해 주세요'
                      : error.code === 'SAFETY_CHECK_UNAVAILABLE'
                        ? '지금은 검수를 요청할 수 없어요'
                        : '접수를 확인하지 못했어요'}
                  </Text>
                  <Text style={styles.body}>
                    {conflict
                      ? '글은 그대로 남아 있어요. 이전으로 돌아가 작성 상태를 확인해 주세요.'
                      : '글을 유지했어요. 잠시 후 같은 글로 다시 요청할 수 있어요.'}
                  </Text>
                </View>
              )}
              <Button
                label="검수 요청하기"
                busy={pending}
                disabled={!flow.valid || conflict}
                onPress={() => void flow.submit()}
              />
              <Text style={[styles.hint, styles.panel]}>
                검수 전에는 다른 사람에게 보여 주지 않아요. 초안은 시연을
                끝내거나 앱을 다시 실행하면 사라져요.
              </Text>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </NightScreen>
  );
  return modal ? (
    <Modal
      visible
      animationType="none"
      onRequestClose={flow.back}
      testID="text-card-modal"
    >
      {content}
    </Modal>
  ) : (
    content
  );
}
const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: 20, paddingBottom: 32, gap: 20, flexGrow: 1 },
  back: {
    alignSelf: 'flex-start',
    minHeight: 48,
    justifyContent: 'center',
    paddingRight: 20,
  },
  link: {
    fontFamily: theme.font,
    color: theme.color.text,
    fontSize: 15,
    lineHeight: 24,
  },
  preview: {
    color: theme.color.muted,
    fontFamily: theme.font,
    fontSize: 12,
    lineHeight: 18,
  },
  panel: { backgroundColor: '#2B3591', borderRadius: 12, padding: 20, gap: 14 },
  title: {
    fontFamily: theme.font,
    color: theme.color.text,
    fontSize: 22,
    lineHeight: 32,
    fontWeight: '700',
  },
  body: {
    fontFamily: theme.font,
    color: theme.color.text,
    fontSize: 15,
    lineHeight: 24,
  },
  section: {
    fontFamily: theme.font,
    color: theme.color.text,
    fontSize: 17,
    lineHeight: 26,
    fontWeight: '700',
  },
  hint: {
    fontFamily: theme.font,
    color: theme.color.muted,
    fontSize: 12,
    lineHeight: 20,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    minHeight: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#6875CA',
    paddingHorizontal: 18,
    paddingVertical: 12,
    justifyContent: 'center',
    maxWidth: '100%',
  },
  selected: {
    backgroundColor: theme.color.primary,
    borderColor: theme.color.primary,
  },
  chipLabel: {
    fontFamily: theme.font,
    color: theme.color.text,
    fontSize: 14,
    lineHeight: 22,
    flexShrink: 1,
  },
  selectedLabel: { color: '#252565', fontWeight: '700' },
  input: {
    minHeight: 180,
    padding: 0,
    fontFamily: theme.font,
    color: theme.color.text,
    fontSize: 16,
    lineHeight: 26,
  },
  counter: {
    fontFamily: theme.font,
    color: theme.color.muted,
    fontSize: 13,
    lineHeight: 22,
    textAlign: 'right',
  },
  error: {
    fontFamily: theme.font,
    color: theme.color.error,
    fontSize: 14,
    lineHeight: 24,
  },
});

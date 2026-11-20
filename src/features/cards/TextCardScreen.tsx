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
import { SupportContent } from '../support/SupportContent';
import { categories } from '../night/categories';
import { TextCardArtwork } from './TextCardArtwork';
import { PREVIEW_TEXT_CARD_LIMIT, type TextCardActions } from './types';
import { useTextCardWriting } from './useTextCardWriting';
import { SubmissionRecoveryPanel } from './SubmissionRecoveryPanel';
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
  conflictTitle = '작성할 수 있는 밤을 확인해 주세요',
}: {
  actions: TextCardActions;
  sourceNightId?: string;
  onBack: () => void;
  onDone: () => void;
  modal?: boolean;
  externalCategory?: boolean;
  completionLabel?: string;
  conflictTitle?: string;
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
              <Text style={styles.link}>←</Text>
              <Text style={styles.headerTitle}>
                {step === 'category' ? '카드 쓰기' : '글귀 작성'}
              </Text>
            </Pressable>
          )}
          {step === 'complete' ? (
            <>
              <View style={styles.spacer} />
              <TextCardArtwork />
              <View style={styles.completion}>
                <Text style={styles.title} accessibilityRole="header">
                  카드를 맡겼어요
                </Text>
                <Text style={styles.completionHint}>
                  검수가 끝나면 누군가의 밤에 나타나요
                </Text>
              </View>
              <View style={styles.spacer} />
              <Button label={completionLabel} onPress={onDone} />
            </>
          ) : step === 'support' ? (
            <SupportContent
              support={error?.support}
              onReturn={flow.returnToDraft}
            />
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
              <View style={styles.recipient}>
                <Text style={styles.hint}>
                  받는 사람: {category?.label} 고민으로 잠 못 드는 누군가
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
                  style={[styles.input, !!draft.text && theme.contentText]}
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
              </View>
              <Text style={styles.hint}>내 말로 적어 주세요.</Text>
              <View style={styles.spacer} />
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
                      ? conflictTitle
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
                disabled={!flow.valid || conflict || flow.recoveryChanged}
                onPress={() => void flow.submit()}
              />
              {flow.originalSubmission && (
                <SubmissionRecoveryPanel
                  original={flow.originalSubmission.content.text}
                  pending={pending}
                  onRecover={flow.recover}
                />
              )}
              <Text style={styles.hint}>
                검수 전에는 다른 사람에게 보여 주지 않아요.
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
  spacer: { flexGrow: 1, minHeight: 16 },
  headerTitle: {
    fontFamily: theme.font,
    fontSize: 18,
    lineHeight: 27,
    fontWeight: '700',
    color: theme.color.text,
  },
  recipient: {
    padding: 14,
    backgroundColor: '#2B3591',
    boxShadow: '4px 4px 0 #0E1040',
  },
  completion: { alignItems: 'center', gap: 14 },
  completionHint: {
    fontFamily: theme.font,
    fontSize: 18,
    lineHeight: 27,
    color: theme.color.muted,
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 24,
    gap: 14,
    flexGrow: 1,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    justifyContent: 'flex-start',
    paddingRight: 20,
  },
  link: {
    fontFamily: theme.font,
    color: theme.color.text,
    fontSize: 18,
    lineHeight: 27,
  },
  preview: {
    color: theme.color.muted,
    fontFamily: theme.font,
    fontSize: 14,
    lineHeight: 21,
  },
  panel: {
    backgroundColor: '#2B3591',
    padding: 14,
    gap: 8,
    boxShadow: '4px 4px 0 #0E1040',
  },
  title: {
    fontFamily: theme.font,
    color: theme.color.text,
    fontSize: 24,
    lineHeight: 36,
    fontWeight: '700',
  },
  body: {
    fontFamily: theme.font,
    color: theme.color.text,
    fontSize: 18,
    lineHeight: 27,
  },
  section: {
    fontFamily: theme.font,
    color: theme.color.text,
    fontSize: 18,
    lineHeight: 27,
    fontWeight: '700',
  },
  hint: {
    fontFamily: theme.font,
    color: theme.color.muted,
    fontSize: 14,
    lineHeight: 22,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    minHeight: 48,
    borderRadius: 0,
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
    fontSize: 16,
    lineHeight: 24,
    flexShrink: 1,
  },
  selectedLabel: { color: '#252565', fontWeight: '700' },
  input: {
    minHeight: 200,
    padding: 0,
    fontFamily: theme.font,
    color: theme.color.text,
    fontSize: 18,
    lineHeight: 28,
  },
  counter: {
    fontFamily: theme.font,
    color: theme.color.muted,
    fontSize: 16,
    lineHeight: 25,
    textAlign: 'right',
  },
  error: {
    fontFamily: theme.font,
    color: theme.color.error,
    fontSize: 16,
    lineHeight: 26,
  },
});

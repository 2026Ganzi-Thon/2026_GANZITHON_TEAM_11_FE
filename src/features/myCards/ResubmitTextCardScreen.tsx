import { useRef, useState, type ComponentRef } from 'react';
import { Image } from 'expo-image';
import {
  Keyboard,
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
import { PREVIEW_TEXT_CARD_LIMIT, type TextCardCategory } from '../cards/types';
import { categories } from '../night/categories';
import type { MyCardResubmitActions, RejectedTextCard } from './types';
import { useTextCardResubmit } from './useTextCardResubmit';

function fieldMessage(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value))
    return value.filter((v) => typeof v === 'string').join('\n') || null;
  return null;
}
export function ResubmitTextCardScreen({
  item,
  actions,
  onClose,
  onRefresh,
}: {
  item: RejectedTextCard;
  actions: MyCardResubmitActions;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const flow = useTextCardResubmit(item, actions, onClose);
  const [choosing, setChoosing] = useState(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const { draft, pending, error, step } = flow;
  const category = categories.find((c) => c.id === draft.category_id);
  const textError = fieldMessage(error?.fields?.['content.text']);
  const categoryError = fieldMessage(error?.fields?.category_id);
  const close = step === 'complete' || flow.blocked ? onRefresh : flow.close;
  return (
    <Modal
      visible
      animationType="none"
      onRequestClose={pending ? () => {} : close}
      testID="resubmit-text-modal"
    >
      <NightScreen
        background={require('../../../assets/images/my-cards/background.svg')}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="목록으로"
            accessibilityState={{ disabled: pending }}
            disabled={pending}
            onPress={close}
            style={styles.back}
          >
            <Text style={styles.arrow}>←</Text>
          </Pressable>
          <Text accessibilityRole="header" style={styles.title}>
            다시 내기
          </Text>
        </View>
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            key={step}
            ref={scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
          >
            {step === 'complete' ? (
              <>
                <View style={styles.panel}>
                  <Text style={styles.resultTitle} accessibilityRole="header">
                    다시 검수를 맡겼어요
                  </Text>
                  <Text style={styles.body}>
                    수정한 카드는 검수 중이에요. 승인된 뒤 다른 사람에게 보여요.
                  </Text>
                  <Text style={styles.caption}>
                    같은 카드의 글을 수정했어요. 새 카드를 만들지 않았어요.
                  </Text>
                </View>
                <Button label="내 카드로 돌아가기" onPress={onRefresh} />
              </>
            ) : step === 'support' ? (
              <>
                <View style={styles.panel}>
                  <Text style={styles.resultTitle} accessibilityRole="header">
                    제출을 잠시 멈췄어요
                  </Text>
                  <Text style={styles.body}>
                    {error?.serverMessage ?? '지금은 잠시 쉬어 가도 괜찮아요.'}
                  </Text>
                  <Text style={styles.caption}>
                    쓰던 글은 이 시연 안에 남아 있어요. 도움 안내는 예시이며
                    실제 안전 검사와 연결되지 않았어요.
                  </Text>
                </View>
                <Button
                  label="쓰던 글로 돌아가기"
                  onPress={flow.returnToDraft}
                />
              </>
            ) : (
              <>
                <View style={[styles.panel, styles.reason]}>
                  <View style={styles.row}>
                    <Image
                      source={require('../../../assets/images/resubmit-text/rejection.svg')}
                      style={styles.icon}
                      accessibilityElementsHidden
                      importantForAccessibility="no"
                    />
                    <Text style={styles.reasonTitle}>반려 사유</Text>
                  </View>
                  <Text style={styles.reasonBody}>
                    {item.rejection_reason || '반려 사유를 확인하고 있어요.'}
                  </Text>
                </View>
                <View style={styles.paper}>
                  <View style={styles.paperHeader}>
                    <View style={styles.row}>
                      <View style={styles.dot} />
                      <Text style={styles.paperCaption}>
                        짧은 글 · 고치는 중
                      </Text>
                    </View>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>반려됨</Text>
                    </View>
                  </View>
                  <TextInput
                    accessibilityLabel="짧은 글 수정"
                    multiline
                    editable={!pending && !flow.blocked}
                    value={draft.text}
                    onChangeText={(text) => flow.update({ text })}
                    textAlignVertical="top"
                    scrollEnabled
                    style={styles.input}
                  />
                  <View style={styles.divider} />
                  <Text
                    style={[
                      styles.counter,
                      flow.length > PREVIEW_TEXT_CARD_LIMIT &&
                        styles.paperError,
                    ]}
                    accessibilityLiveRegion="polite"
                  >
                    {flow.length} / {PREVIEW_TEXT_CARD_LIMIT}
                  </Text>
                </View>
                <View style={styles.panel}>
                  <View style={styles.paperHeader}>
                    <Text style={styles.body}>
                      고민 분류 · {category?.label ?? '분류를 골라 주세요'}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="분류 변경"
                      accessibilityState={{
                        disabled: pending || flow.blocked,
                        expanded: choosing,
                      }}
                      disabled={pending || flow.blocked}
                      onPress={() => setChoosing(!choosing)}
                      style={styles.change}
                    >
                      <Text style={styles.link}>분류 변경</Text>
                    </Pressable>
                  </View>
                  {choosing && (
                    <View style={styles.chips}>
                      {categories
                        .filter((c) => c.id !== 'none')
                        .map((c) => (
                          <Pressable
                            key={c.id}
                            accessibilityRole="radio"
                            accessibilityLabel={c.label}
                            accessibilityState={{
                              checked: draft.category_id === c.id,
                              disabled: pending || flow.blocked,
                            }}
                            disabled={pending || flow.blocked}
                            onPress={() => {
                              flow.update({
                                category_id: c.id as TextCardCategory,
                              });
                              setChoosing(false);
                            }}
                            style={[
                              styles.chip,
                              draft.category_id === c.id && styles.selected,
                            ]}
                          >
                            <Text
                              style={[
                                styles.body,
                                draft.category_id === c.id &&
                                  styles.selectedLabel,
                              ]}
                            >
                              {c.label}
                            </Text>
                          </Pressable>
                        ))}
                    </View>
                  )}
                </View>
                <View style={[styles.panel, styles.info]}>
                  <Image
                    source={require('../../../assets/images/resubmit-text/info.svg')}
                    style={styles.icon}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  />
                  <Text style={[styles.caption, styles.fill]}>
                    고친 뒤 다시 검수해요. 수정은 반려된 카드만 가능해요.
                  </Text>
                </View>
                {error && (
                  <View
                    style={styles.panel}
                    accessibilityRole="alert"
                    testID="resubmit-error-summary"
                    onLayout={(e) =>
                      scroll.current?.scrollTo({
                        y: e.nativeEvent.layout.y,
                        animated: false,
                      })
                    }
                  >
                    <Text style={styles.section}>
                      {flow.blocked
                        ? '카드의 최신 상태를 확인해 주세요'
                        : textError || categoryError
                          ? '수정할 내용을 확인해 주세요'
                          : error.code === 'SAFETY_CHECK_UNAVAILABLE'
                            ? '지금은 검수를 요청할 수 없어요'
                            : '접수를 확인하지 못했어요'}
                    </Text>
                    {!!textError && (
                      <Text style={styles.error}>글 내용 · {textError}</Text>
                    )}
                    {!!categoryError && (
                      <Text style={styles.error}>
                        고민 분류 · {categoryError}
                      </Text>
                    )}
                    <Text style={styles.body}>
                      {flow.blocked
                        ? '카드가 삭제되었거나 상태가 바뀌었을 수 있어요. 최신 목록에서 확인해 주세요.'
                        : '수정한 글을 유지했어요. 잠시 후 같은 글로 다시 요청할 수 있어요.'}
                    </Text>
                  </View>
                )}
                {flow.blocked && (
                  <Button label="최신 목록 확인" onPress={onRefresh} />
                )}
                {pending && (
                  <Text
                    style={[styles.caption, styles.panel]}
                    accessibilityLiveRegion="polite"
                  >
                    접수를 확인하고 있어요. 잠시 기다려 주세요.
                  </Text>
                )}
                <Button
                  label="다시 검수 요청"
                  busy={pending}
                  disabled={!flow.valid || flow.blocked}
                  onPress={() => {
                    Keyboard.dismiss();
                    void flow.submit();
                  }}
                />
              </>
            )}
            <Text style={[styles.caption, styles.panel]}>
              미리보기 · 서버 전송 안 함. 앞뒤 공백을 제외한 200자는 임시
              기준이에요. 수정 초안은 같은 시연 안에서만 유지되고 시연 종료·앱
              재실행 시 사라져요.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </NightScreen>
    </Modal>
  );
}
const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    minHeight: 52,
    gap: 10,
  },
  back: {
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrow: { fontSize: 20, color: theme.color.text },
  title: {
    fontFamily: theme.font,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    color: theme.color.text,
    flexShrink: 1,
  },
  content: { flexGrow: 1, padding: 20, gap: 14, paddingBottom: 32 },
  panel: {
    backgroundColor: '#2B3591',
    padding: 14,
    gap: 6,
    boxShadow: '4px 4px 0 #0E1040',
  },
  reason: {
    borderLeftWidth: 4,
    borderLeftColor: '#F9CFDD',
    paddingLeft: 18,
    paddingVertical: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  icon: { width: 18, height: 18, flexShrink: 0 },
  reasonTitle: {
    fontFamily: theme.font,
    fontSize: 12,
    lineHeight: 20,
    fontWeight: '700',
    color: '#F9CFDD',
  },
  reasonBody: {
    fontFamily: theme.font,
    fontSize: 13,
    lineHeight: 20,
    color: theme.color.text,
  },
  paper: {
    backgroundColor: '#FFF4D6',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 220,
    gap: 10,
    boxShadow: '4px 4px 0 #0E1040',
  },
  paperHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  dot: { width: 6, height: 6, backgroundColor: '#5B6BC8' },
  paperCaption: {
    fontFamily: theme.font,
    fontSize: 11,
    lineHeight: 18,
    color: '#4A5290',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#F9CFDD',
  },
  badgeText: {
    fontFamily: theme.font,
    fontSize: 11,
    lineHeight: 18,
    fontWeight: '700',
    color: '#1E2063',
  },
  input: {
    minHeight: 130,
    padding: 0,
    fontFamily: theme.font,
    fontSize: 15,
    lineHeight: 24,
    color: '#242565',
  },
  divider: { height: 1, backgroundColor: '#EADCB4' },
  counter: {
    textAlign: 'right',
    fontFamily: theme.font,
    fontSize: 12,
    lineHeight: 20,
    color: '#4A5290',
  },
  paperError: {
    fontFamily: theme.font,
    fontSize: 14,
    lineHeight: 22,
    color: '#A9124C',
  },
  body: {
    fontFamily: theme.font,
    fontSize: 13,
    lineHeight: 22,
    color: theme.color.text,
  },
  caption: {
    fontFamily: theme.font,
    fontSize: 12,
    lineHeight: 20,
    color: theme.color.muted,
  },
  section: {
    fontFamily: theme.font,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '700',
    color: theme.color.text,
  },
  resultTitle: {
    fontFamily: theme.font,
    fontSize: 20,
    lineHeight: 30,
    fontWeight: '700',
    color: theme.color.text,
  },
  info: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  change: {
    minHeight: 48,
    minWidth: 48,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  link: {
    fontFamily: theme.font,
    fontSize: 12,
    lineHeight: 20,
    color: theme.color.text,
    textDecorationLine: 'underline',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { padding: 12, minHeight: 48, borderWidth: 1, borderColor: '#6875CA' },
  selected: { backgroundColor: theme.color.primary },
  selectedLabel: { color: '#252565' },
  error: {
    fontFamily: theme.font,
    fontSize: 14,
    lineHeight: 24,
    color: theme.color.error,
  },
});

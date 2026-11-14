import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../ui/Button';
import { theme } from '../../ui/theme';
import type { WorryDeletions } from './deletions';

export function WorryDeleteDialog({
  nightId,
  nightDate,
  source,
  onCancel,
  onDeleted,
}: {
  nightId: string;
  nightDate: string;
  source: WorryDeletions;
  onCancel: () => void;
  onDeleted: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const request = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const completed = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      request.current?.abort();
    };
  }, [source]);
  const cancel = () => {
    if (!request.current) onCancel();
  };
  const remove = async () => {
    if (request.current || !alive.current || completed.current) return;
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setError(false);
    try {
      await source.remove(nightId, controller.signal);
      if (alive.current && !controller.signal.aborted) {
        completed.current = true;
        onDeleted();
      }
    } catch {
      if (alive.current && !controller.signal.aborted) setError(true);
    } finally {
      if (request.current === controller) request.current = null;
      if (alive.current && !controller.signal.aborted) setPending(false);
    }
  };
  return (
    <Modal
      transparent
      visible
      animationType="none"
      onRequestClose={cancel}
      testID="worry-delete-modal"
    >
      <SafeAreaView style={styles.shade}>
        <ScrollView
          style={styles.sheet}
          contentContainerStyle={styles.content}
          accessibilityViewIsModal
        >
          <Text accessibilityRole="header" style={styles.title}>
            이 고민을 지울까요?
          </Text>
          <Text style={styles.target}>{nightDate} 밤의 고민</Text>
          <Text style={styles.body}>
            고민 원문만 지워요. 양과 카드, 저장된 회고는 그대로예요. 원문은
            되돌릴 수 없어요.
          </Text>
          {error && (
            <View accessibilityRole="alert" style={styles.error}>
              <Text style={styles.errorTitle}>
                삭제 결과를 확인하지 못했어요
              </Text>
              <Text style={styles.body}>
                같은 밤의 고민으로 다시 시도해 주세요.
              </Text>
            </View>
          )}
          {pending && (
            <Text style={styles.body} accessibilityLiveRegion="polite">
              삭제 결과를 확인한 뒤 창을 닫을 수 있어요.
            </Text>
          )}
          <Button
            label={pending ? '삭제 확인 중' : error ? '다시 지우기' : '지우기'}
            busy={pending}
            onPress={() => void remove()}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="취소"
            accessibilityState={{ disabled: pending }}
            disabled={pending}
            onPress={cancel}
            style={[styles.cancel, pending && styles.disabled]}
          >
            <Text style={styles.cancelLabel}>취소</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  shade: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    flexGrow: 0,
    maxHeight: '90%',
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    backgroundColor: '#1E2063',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  content: { paddingHorizontal: 20, paddingVertical: 28, gap: 12 },
  title: {
    fontFamily: theme.font,
    color: theme.color.text,
    fontSize: 22,
    lineHeight: 32,
    fontWeight: '700',
    textAlign: 'center',
  },
  target: {
    fontFamily: theme.font,
    color: theme.color.muted,
    fontSize: 13,
    lineHeight: 21,
    textAlign: 'center',
  },
  body: {
    fontFamily: theme.font,
    color: theme.color.muted,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  error: { padding: 12, gap: 8, backgroundColor: theme.color.panel },
  errorTitle: {
    fontFamily: theme.font,
    color: theme.color.error,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    fontWeight: '700',
  },
  cancel: {
    minHeight: 52,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2B3591',
    boxShadow: '4px 4px 0 #0E1040',
  },
  cancelLabel: {
    fontFamily: theme.font,
    fontSize: 15,
    lineHeight: 22,
    color: theme.color.text,
    fontWeight: '700',
  },
  disabled: { opacity: 0.6 },
});

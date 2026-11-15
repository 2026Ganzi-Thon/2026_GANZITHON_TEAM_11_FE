import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { theme } from '../../ui/theme';
import type { HomeContext } from './useHomeContext';
export function HomeNightButton({
  flow,
  blocked = false,
}: {
  flow: HomeContext;
  blocked?: boolean;
}) {
  const disabled =
    blocked || flow.pending || flow.error || flow.snapshot?.phase !== 'night';
  const label = flow.pending
    ? '시간 확인 중'
    : flow.error || !flow.snapshot
      ? '시간을 확인해 주세요'
      : flow.snapshot.phase === 'day'
        ? '밤 9시에 열려요'
        : '오늘 밤 양 세러 가기';
  return (
    <View style={styles.footer}>
      {flow.error && (
        <View style={styles.feedback}>
          <Text style={styles.error} accessibilityRole="alert">
            홈 시간을 확인하지 못했어요.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="홈 상태 다시 확인"
            onPress={flow.refresh}
            style={styles.retry}
          >
            <Text style={styles.error}>홈 상태 다시 확인</Text>
          </Pressable>
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled, busy: flow.pending }}
        disabled={disabled}
        onPress={flow.open}
        style={({ pressed }) => [
          styles.button,
          disabled && styles.disabled,
          pressed && !disabled && styles.pressed,
        ]}
      >
        {flow.pending && <ActivityIndicator color="#FFFFFF" />}
        <Text style={styles.label}>{label}</Text>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  footer: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, gap: 10 },
  button: {
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: '#2F3A9E',
    boxShadow: '5px 5px 0 rgba(30,32,99,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  disabled: {
    backgroundColor: '#50748E',
    boxShadow: '5px 5px 0 rgba(30,32,99,0.22)',
  },
  pressed: { opacity: 0.8 },
  label: {
    fontFamily: theme.font,
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 24,
    fontWeight: '700',
    textAlign: 'center',
    flexShrink: 1,
  },
  feedback: { padding: 10, gap: 4, backgroundColor: '#FFF4D6' },
  error: {
    fontFamily: theme.font,
    color: '#2F3A9E',
    fontSize: 14,
    lineHeight: 22,
  },
  retry: { paddingVertical: 8, minHeight: 44, justifyContent: 'center' },
});

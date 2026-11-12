import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { theme } from './theme';

export function Button({
  label,
  onPress,
  busy = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        (pressed || disabled || busy) && styles.dim,
      ]}
    >
      {busy && <ActivityIndicator color={theme.color.background} />}
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: theme.radius,
    backgroundColor: theme.color.primary,
    padding: 12,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: theme.font,
    fontWeight: '700',
    fontSize: 15,
    lineHeight: 22,
    includeFontPadding: false,
    color: theme.color.background,
    textAlign: 'center',
  },
  dim: { opacity: 0.65 },
});

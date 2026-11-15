import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { Image } from 'expo-image';
import { theme } from '../../ui/theme';
export function NightSupportButton({
  label,
  onPress,
  disabled,
  busy = false,
  kind = 'continue',
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  busy?: boolean;
  kind?: 'continue' | 'call' | 'open_url';
}) {
  const row = kind !== 'continue';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        row ? styles.row : styles.secondary,
        (pressed || disabled || busy) && styles.dim,
      ]}
    >
      {busy && <ActivityIndicator color={theme.color.text} />}
      <Text style={[styles.label, row && styles.rowLabel]}>{label}</Text>
      {kind === 'call' && (
        <Image
          source={require('../../../assets/images/night-support/phone.svg')}
          style={styles.phone}
          accessible={false}
        />
      )}
      {kind === 'open_url' && (
        <Text style={styles.link} accessible={false}>
          ↗
        </Text>
      )}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  row: {
    minHeight: 60,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#4A5BC2',
  },
  secondary: {
    minHeight: 52,
    padding: 12,
    gap: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#4A5BC2',
    backgroundColor: '#1E2063',
  },
  label: {
    flexShrink: 1,
    fontFamily: theme.font,
    fontSize: 15,
    lineHeight: 24,
    fontWeight: '700',
    color: theme.color.text,
    textAlign: 'center',
  },
  rowLabel: { flex: 1, fontWeight: '400', textAlign: 'left' },
  phone: { width: 18, height: 18 },
  link: { fontSize: 18, color: theme.color.text },
  dim: { opacity: 0.65 },
});

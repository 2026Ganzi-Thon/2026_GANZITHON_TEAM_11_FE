import {
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { theme } from './theme';

export function FormField({
  label,
  error,
  ...input
}: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...input}
        placeholderTextColor={theme.color.muted}
        selectionColor={theme.color.primary}
        style={[styles.input, error && styles.invalid, input.style]}
      />
      {error && (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={styles.error}
        >
          {error}
        </Text>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  field: { gap: 8 },
  label: {
    fontFamily: theme.font,
    color: theme.color.muted,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
  },
  input: {
    fontFamily: theme.font,
    color: theme.color.text,
    fontSize: 14,
    minHeight: 48,
    lineHeight: 21,
    includeFontPadding: false,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: theme.color.input,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  invalid: { borderColor: theme.color.error },
  error: {
    fontFamily: theme.font,
    color: theme.color.error,
    fontSize: 12,
    lineHeight: 18,
  },
});

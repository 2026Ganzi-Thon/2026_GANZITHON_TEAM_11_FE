import { StyleSheet, Text, View } from 'react-native';
import { theme } from './theme';

export function Notice({
  title,
  description,
  error = false,
}: {
  title: string;
  description?: string;
  error?: boolean;
}) {
  return (
    <View style={styles.panel} accessibilityLiveRegion="polite">
      <Text
        accessibilityRole={error ? 'alert' : undefined}
        style={[styles.title, error && styles.error]}
      >
        {title}
      </Text>
      {description && <Text style={styles.description}>{description}</Text>}
    </View>
  );
}
const styles = StyleSheet.create({
  panel: {
    backgroundColor: theme.color.panel,
    borderRadius: theme.radius,
    padding: 14,
    gap: 6,
  },
  title: {
    fontFamily: theme.font,
    fontSize: 14,
    lineHeight: 21,
    color: theme.color.text,
  },
  description: {
    fontFamily: theme.font,
    fontSize: 12,
    lineHeight: 18,
    color: theme.color.muted,
  },
  error: { color: theme.color.error },
});

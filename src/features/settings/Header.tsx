import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../ui/theme';
export function Header({
  title,
  backLabel,
  onBack,
}: {
  title: string;
  backLabel: string;
  onBack: () => void;
}) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        onPress={onBack}
        style={styles.back}
      >
        <Text style={styles.arrow}>←</Text>
      </Pressable>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 16,
  },
  back: { minWidth: 40, minHeight: 48, justifyContent: 'center' },
  arrow: { fontFamily: theme.font, fontSize: 24, color: theme.color.text },
  title: {
    flex: 1,
    fontFamily: theme.font,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    color: theme.color.text,
  },
});

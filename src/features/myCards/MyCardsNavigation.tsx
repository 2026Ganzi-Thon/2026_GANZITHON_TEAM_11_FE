import { Image, type ImageSource } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../ui/theme';
function Icon({
  source,
  width,
  height,
  selected = false,
}: {
  source: ImageSource;
  width: number;
  height: number;
  selected?: boolean;
}) {
  return (
    <View style={[styles.icon, selected && styles.selectedIcon]}>
      <Image
        source={source}
        contentFit="contain"
        style={{ width, height }}
        accessible={false}
      />
    </View>
  );
}
export function MyCardsNavigation({
  onHome,
  onSettings,
}: {
  onHome: () => void;
  onSettings?: () => void;
}) {
  return (
    <View style={styles.navigation} testID="my-cards-navigation">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="홈으로 돌아가기"
        onPress={onHome}
        style={styles.item}
      >
        <Icon
          source={require('../../../assets/images/morning/sheep-neutral.svg')}
          width={33}
          height={27.5}
        />
        <Text style={styles.label}>홈</Text>
      </Pressable>
      <View
        accessible
        accessibilityRole="tab"
        accessibilityLabel="내 카드"
        accessibilityState={{ selected: true }}
        style={[styles.item, styles.selected]}
      >
        <Icon
          source={require('../../../assets/images/first-night-home/my-cards.svg')}
          width={24}
          height={18}
          selected
        />
        <Text style={[styles.label, styles.selectedLabel]}>내 카드</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={onSettings ? '설정 열기' : '설정 · 준비 중'}
        accessibilityState={{ disabled: !onSettings }}
        disabled={!onSettings}
        onPress={onSettings}
        style={[styles.item, !onSettings && styles.disabled]}
      >
        <Icon
          source={require('../../../assets/images/first-night-home/settings.svg')}
          width={20}
          height={20}
        />
        <Text style={styles.label}>
          {onSettings ? '설정' : '설정 · 준비 중'}
        </Text>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  navigation: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 6,
    minHeight: 64,
    backgroundColor: '#1B1C55',
    borderTopWidth: 1,
    borderTopColor: '#4A5BC2',
  },
  item: {
    flex: 1,
    paddingHorizontal: 6,
    minHeight: 48,
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  selected: { borderBottomColor: theme.color.primary },
  icon: {
    width: 36,
    height: 28,
    borderRadius: 4,
    backgroundColor: theme.color.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedIcon: { backgroundColor: theme.color.primary },
  label: {
    fontFamily: theme.font,
    fontSize: 14,
    lineHeight: 21,
    color: theme.color.muted,
    textAlign: 'center',
    flexShrink: 1,
  },
  selectedLabel: { color: theme.color.primary, fontWeight: '700' },
  disabled: { opacity: 0.6 },
});

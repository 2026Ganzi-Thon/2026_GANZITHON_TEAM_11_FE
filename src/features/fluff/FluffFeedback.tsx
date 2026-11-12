import { Image } from 'expo-image';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { theme } from '../../ui/theme';
const glow = [
  [
    require('../../../assets/images/fluff/toast-glow-outer.svg'),
    -9,
    -9,
    270,
    66,
  ],
  [require('../../../assets/images/fluff/toast-glow-mid.svg'), -6, -6, 264, 60],
  [
    require('../../../assets/images/fluff/toast-glow-inner.svg'),
    -3,
    -3,
    258,
    54,
  ],
] as const;
export function FluffFeedback({ saved }: { saved: boolean }) {
  const { fontScale } = useWindowDimensions();
  return (
    <View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[styles.toast, fontScale > 1.3 && styles.backing]}
    >
      {saved &&
        glow.map(([source, left, top, width, height], i) => (
          <Image
            key={i}
            accessible={false}
            source={source}
            contentFit="fill"
            style={{ position: 'absolute', left, top, width, height }}
          />
        ))}
      <Image
        accessible={false}
        source={require('../../../assets/images/fluff/toast-bg.svg')}
        contentFit="fill"
        style={styles.bg}
      />
      <Image
        accessible={false}
        source={require('../../../assets/images/fluff/toast-icon.svg')}
        contentFit="fill"
        style={styles.icon}
      />
      <Text style={styles.text}>
        {saved ? '솜털을 붙였어요' : '솜털을 뗐어요'}
      </Text>
      {saved && (
        <Image
          accessible={false}
          source={require('../../../assets/images/fluff/toast-sparkles.svg')}
          contentFit="fill"
          style={styles.sparkles}
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  toast: {
    width: 252,
    minHeight: 48,
    paddingLeft: 48,
    paddingRight: 14,
    paddingVertical: 14,
  },
  backing: { backgroundColor: '#1E2063' },
  bg: { position: 'absolute', left: 0, top: 0, width: 252, height: 48 },
  icon: { position: 'absolute', left: 16, top: 18, width: 22, height: 12 },
  sparkles: { position: 'absolute', left: -12, top: 6, width: 275, height: 39 },
  text: {
    fontFamily: theme.font,
    color: theme.color.text,
    fontSize: 13,
    lineHeight: 20,
    includeFontPadding: false,
  },
});

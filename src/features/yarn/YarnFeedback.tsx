import { Image } from 'expo-image';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { theme } from '../../ui/theme';
const glow = [
  [
    require('../../../assets/images/yarn/toast-glow-outer.svg'),
    -9,
    -9,
    270,
    66,
  ],
  [require('../../../assets/images/yarn/toast-glow-mid.svg'), -6, -6, 264, 60],
  [
    require('../../../assets/images/yarn/toast-glow-inner.svg'),
    -3,
    -3,
    258,
    54,
  ],
] as const;
const sentIcons = [
  [
    require('../../../assets/images/yarn/toast-sent-icon-a.svg'),
    14,
    14,
    20,
    18,
  ],
  [
    require('../../../assets/images/yarn/toast-sent-icon-b.svg'),
    16,
    18,
    16,
    10,
  ],
  [require('../../../assets/images/yarn/toast-sent-icon-c.svg'), 30, 30, 8, 4],
] as const;
const removedIcons = [
  [
    require('../../../assets/images/yarn/toast-removed-icon-a.svg'),
    14,
    14,
    20,
    18,
  ],
  [
    require('../../../assets/images/yarn/toast-removed-icon-b.svg'),
    16,
    18,
    16,
    10,
  ],
  [
    require('../../../assets/images/yarn/toast-removed-icon-c.svg'),
    30,
    30,
    8,
    4,
  ],
] as const;
export function YarnFeedback({ sent, user }: { sent: boolean; user: boolean }) {
  const { fontScale } = useWindowDimensions();
  return (
    <View
      style={[styles.toast, fontScale > 1.3 && styles.expandedBacking]}
      pointerEvents="none"
      accessibilityLiveRegion="polite"
    >
      {sent &&
        glow.map(([source, left, top, width, height], i) => (
          <Image
            key={'g' + i}
            source={source}
            accessible={false}
            contentFit="fill"
            style={{ position: 'absolute', left, top, width, height }}
          />
        ))}
      <Image
        accessible={false}
        source={
          sent
            ? require('../../../assets/images/yarn/toast-sent-bg.svg')
            : require('../../../assets/images/yarn/toast-removed-bg.svg')
        }
        style={styles.background}
        contentFit="fill"
      />
      {(sent ? sentIcons : removedIcons).map(
        ([source, left, top, width, height], i) => (
          <Image
            key={'i' + i}
            source={source}
            accessible={false}
            contentFit="fill"
            style={{ position: 'absolute', left, top, width, height }}
          />
        ),
      )}
      <Text style={styles.text}>
        {sent
          ? user
            ? '작성자에게 털실을 보냈어요'
            : '털실을 보냈어요'
          : '털실을 거뒀어요'}
      </Text>
      {sent && (
        <Image
          accessible={false}
          source={require('../../../assets/images/yarn/toast-sparkles.svg')}
          style={styles.sparkles}
          contentFit="fill"
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
  expandedBacking: { backgroundColor: '#1E2063' },
  background: { position: 'absolute', left: 0, top: 0, width: 252, height: 48 },
  text: {
    fontFamily: theme.font,
    color: theme.color.text,
    fontSize: 13,
    lineHeight: 20,
    includeFontPadding: false,
  },
  sparkles: { position: 'absolute', left: -12, top: 6, width: 275, height: 39 },
});

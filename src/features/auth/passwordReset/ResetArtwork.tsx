import { Image } from 'expo-image';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { theme } from '../../../ui/theme';
const letters = [
  [126, 54],
  [176, 85],
  [255, 34],
] as const;
const marks = [
  [163, 47, '--'],
  [163, 54, '-'],
  [213, 79, '---'],
  [213, 86, '--'],
  [287, 29, '----'],
  [287, 36, '---'],
] as const;
export function ResetArtwork() {
  const { width } = useWindowDimensions(),
    scale = Math.min(1, Math.max(0, width - 40) / 318);
  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: 318 * scale, height: 180 * scale, alignSelf: 'center' }}
    >
      {letters.map(([left, top]) => (
        <Image
          key={left}
          accessible={false}
          source={require('../../../../assets/images/password-reset/mail.svg')}
          contentFit="contain"
          style={{
            position: 'absolute',
            left: left * scale,
            top: top * scale,
            width: 33 * scale,
            height: 22 * scale,
          }}
        />
      ))}
      <Image
        accessible={false}
        source={require('../../../../assets/images/password-reset/sheep.svg')}
        contentFit="contain"
        style={{
          position: 'absolute',
          left: 29 * scale,
          top: 69 * scale,
          width: 76 * scale,
          height: 66 * scale,
        }}
      />
      {marks.map(([left, top, label]) => (
        <Text
          key={`${left}-${top}`}
          accessible={false}
          allowFontScaling={false}
          style={[
            s.mark,
            {
              left: left * scale,
              top: top * scale,
              fontSize: 11 * scale,
              lineHeight: 11.117 * scale,
              letterSpacing: 1.21 * scale,
              width: 31 * scale,
              height: 18 * scale,
            },
          ]}
        >
          {label}
        </Text>
      ))}
    </View>
  );
}
const s = StyleSheet.create({
  mark: {
    position: 'absolute',
    fontFamily: theme.font,
    fontWeight: '700',
    color: '#FFFFFF',
    includeFontPadding: false,
  },
});

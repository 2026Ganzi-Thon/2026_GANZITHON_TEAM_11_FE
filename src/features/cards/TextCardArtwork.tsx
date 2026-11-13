import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
const layers = [
  [
    require('../../../assets/images/text-card/glow-outer.svg'),
    55,
    14,
    190,
    120,
  ],
  [require('../../../assets/images/text-card/glow-mid.svg'), 75, 26, 150, 96],
  [require('../../../assets/images/text-card/glow-inner.svg'), 95, 37, 110, 74],
  [require('../../../assets/images/text-card/ground.svg'), 40, 112, 226, 2],
  [require('../../../assets/images/text-card/motion.svg'), 56, 62, 24, 27],
  [require('../../../assets/images/text-card/sheep.svg'), 96, 42, 84, 70],
  [require('../../../assets/images/text-card/card.svg'), 174, 80, 24, 17],
  [
    require('../../../assets/images/text-card/card-border.svg'),
    174,
    80,
    24,
    17,
  ],
  [require('../../../assets/images/text-card/card-lines.svg'), 178, 86, 13, 6],
  [require('../../../assets/images/text-card/stars.svg'), 204, 46, 31, 31],
  [require('../../../assets/images/text-card/star.svg'), 238, 30, 11, 11],
] as const;
export function TextCardArtwork() {
  return (
    <View style={styles.art} accessible={false} pointerEvents="none">
      {layers.map(([source, left, top, width, height], i) => (
        <Image
          key={i}
          source={source}
          contentFit="fill"
          style={{ position: 'absolute', left, top, width, height }}
        />
      ))}
      <View style={styles.stamp} />
    </View>
  );
}
const styles = StyleSheet.create({
  art: { width: 320, height: 170, alignSelf: 'center' },
  stamp: {
    position: 'absolute',
    left: 190,
    top: 83,
    width: 5,
    height: 5,
    backgroundColor: '#D6A8FF',
  },
});

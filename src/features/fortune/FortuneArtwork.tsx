import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
const images: readonly [number, number, number, number, number][] = [
  [require('../../../assets/images/fortune/glow-outer.svg'), 0, 0, 66, 61],
  [require('../../../assets/images/fortune/glow-mid.svg'), 7, 7, 52, 47],
  [require('../../../assets/images/fortune/glow-inner.svg'), 13, 13, 40, 35],
  [require('../../../assets/images/fortune/sheep.svg'), 18, 18, 30, 25],
  [require('../../../assets/images/fortune/sparkle.svg'), 30, 6, 8, 8],
];
export function FortuneSheep() {
  return (
    <View
      style={styles.sheep}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {images.map(([source, left, top, width, height], i) => (
        <Image
          key={i}
          source={source}
          accessible={false}
          contentFit="contain"
          style={{ position: 'absolute', left, top, width, height }}
        />
      ))}
      {[
        [8, 14],
        [54, 22],
        [33, 49],
      ].map(([left, top], i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left,
            top,
            width: 3,
            height: 3,
            backgroundColor: '#FFF4D6',
          }}
        />
      ))}
      <View
        style={{
          position: 'absolute',
          left: 44,
          top: 29.25,
          width: 12,
          height: 7,
          backgroundColor: '#FFF4D6',
        }}
      />
      {[42, 56].map((left) => (
        <View
          key={left}
          style={{
            position: 'absolute',
            left,
            top: 28.25,
            width: 2,
            height: 9,
            backgroundColor: '#8C6E62',
          }}
        />
      ))}
    </View>
  );
}
/** Figma's native rectangle layers; the paper height follows its text. */
export function ScrollRod() {
  return (
    <View style={styles.rod} pointerEvents="none" accessible={false}>
      <View style={styles.bar} />
      <View style={styles.highlight} />
      <View style={styles.shade} />
      <View style={[styles.handle, { left: 2 }]} />
      <View style={[styles.handle, { right: 2 }]} />
      <View style={[styles.end, { left: 0 }]} />
      <View style={[styles.end, { right: 0 }]} />
    </View>
  );
}
const styles = StyleSheet.create({
  sheep: { width: 66, height: 61 },
  rod: { height: 16, marginHorizontal: -18, zIndex: 1 },
  bar: {
    position: 'absolute',
    left: 10,
    right: 10,
    height: 16,
    backgroundColor: '#8C6E62',
  },
  highlight: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: 4,
    height: 3,
    backgroundColor: '#A88A7C',
  },
  shade: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: 12,
    height: 2,
    backgroundColor: '#6E544A',
  },
  handle: {
    position: 'absolute',
    top: 2,
    width: 8,
    height: 12,
    backgroundColor: '#6E544A',
  },
  end: {
    position: 'absolute',
    top: 5,
    width: 2,
    height: 6,
    backgroundColor: '#5A443B',
  },
});

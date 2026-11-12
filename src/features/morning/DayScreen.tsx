import type { PropsWithChildren } from 'react';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
const layers: readonly [number, number, number, number, number][] = [
  [require('../../../assets/images/morning/sky-1.svg'), 0, 0, 360, 140],
  [require('../../../assets/images/morning/sky-2.svg'), 0, 140, 360, 140],
  [require('../../../assets/images/morning/sky-3.svg'), 0, 280, 360, 140],
  [require('../../../assets/images/morning/sky-4.svg'), 0, 420, 360, 140],
  [require('../../../assets/images/morning/sky-5.svg'), 0, 560, 360, 220],
  [
    require('../../../assets/images/morning/sun-glow-outer.svg'),
    246,
    100,
    100,
    100,
  ],
  [
    require('../../../assets/images/morning/sun-glow-inner.svg'),
    258,
    112,
    76,
    76,
  ],
  [require('../../../assets/images/morning/sun.svg'), 272, 126, 48, 48],
  [require('../../../assets/images/morning/sun-shade.svg'), 304, 128, 16, 44],
  [require('../../../assets/images/morning/clouds.svg'), 24, 110, 268, 202],
  [require('../../../assets/images/morning/hill-far.svg'), 0, 540, 360, 240],
  [require('../../../assets/images/morning/hill-mid.svg'), 0, 640, 360, 140],
  [require('../../../assets/images/morning/hill-front.svg'), 0, 714, 360, 66],
  [require('../../../assets/images/morning/tree.svg'), 30, 532, 14, 28],
  [require('../../../assets/images/morning/trunk.svg'), 36, 560, 2, 12],
  [require('../../../assets/images/morning/house-wall.svg'), 58, 550, 40, 22],
  [require('../../../assets/images/morning/house-roof.svg'), 54, 534, 48, 18],
  [require('../../../assets/images/morning/chimney.svg'), 88, 532, 5, 10],
  [require('../../../assets/images/morning/window.svg'), 64, 556, 7, 7],
  [require('../../../assets/images/morning/window.svg'), 85, 556, 7, 7],
  [require('../../../assets/images/morning/door.svg'), 74, 560, 8, 12],
  [require('../../../assets/images/morning/fence-post.svg'), 232, 548, 4, 24],
  [require('../../../assets/images/morning/fence-post.svg'), 262, 558, 4, 24],
  [require('../../../assets/images/morning/fence-rail.svg'), 228, 553, 42, 15],
  [require('../../../assets/images/morning/fence-rail.svg'), 228, 561, 42, 15],
  [require('../../../assets/images/morning/grass-yellow.svg'), 30, 630, 3, 3],
  [require('../../../assets/images/morning/grass-pink.svg'), 90, 700, 3, 3],
  [require('../../../assets/images/morning/grass-white.svg'), 170, 640, 3, 3],
  [require('../../../assets/images/morning/grass-yellow.svg'), 250, 700, 3, 3],
  [require('../../../assets/images/morning/grass-pink.svg'), 320, 640, 3, 3],
  [require('../../../assets/images/morning/grass-white.svg'), 60, 750, 3, 3],
  [require('../../../assets/images/morning/grass-yellow.svg'), 210, 760, 3, 3],
  [require('../../../assets/images/morning/grass-white.svg'), 300, 750, 3, 3],
];
const homeLayers: readonly [number, number, number, number, number][] = [
  [
    require('../../../assets/images/morning/home-hill-far.svg'),
    0,
    384,
    360,
    396,
  ],
  [
    require('../../../assets/images/morning/home-hill-mid.svg'),
    0,
    466,
    360,
    314,
  ],
  [
    require('../../../assets/images/morning/home-hill-front.svg'),
    0,
    576,
    360,
    204,
  ],
  [require('../../../assets/images/morning/house-wall.svg'), 250, 382, 40, 22],
  [require('../../../assets/images/morning/house-roof.svg'), 246, 366, 48, 18],
  [
    require('../../../assets/images/morning/home-fence-post.svg'),
    30,
    404,
    4,
    26,
  ],
  [
    require('../../../assets/images/morning/home-fence-post.svg'),
    60,
    414,
    4,
    26,
  ],
  [require('../../../assets/images/morning/fence-rail.svg'), 26, 409, 42, 15],
  [require('../../../assets/images/morning/fence-rail.svg'), 26, 418, 42, 15],
];
const homeDetails: readonly [string, number, number, number, number][] = [
  ['#5B6BC8', 280, 364, 5, 10],
  ['#AFC0FF', 256, 388, 7, 7],
  ['#AFC0FF', 277, 388, 7, 7],
  ['#8C6E62', 266, 392, 8, 12],
  ['#ffe7a3', 176.74, 576.55, 3, 3],
  ['#f9cfdd', 49.26, 516.36, 3, 3],
  ['#FFFFFF', 160.69, 566.21, 3, 3],
  ['#e2d6f8', 36.71, 636.99, 3, 3],
  ['#ffe7a3', 210.4, 548.06, 3, 3],
  ['#f9cfdd', 106.71, 618.44, 3, 3],
  ['#FFFFFF', 233.53, 484.55, 3, 3],
  ['#e2d6f8', 179.51, 514.67, 3, 3],
  ['#ffe7a3', 238.47, 500.02, 3, 3],
  ['#f9cfdd', 200.54, 562.58, 3, 3],
  ['#FFFFFF', 69.91, 479.51, 3, 3],
  ['#e2d6f8', 329.3, 654.28, 3, 3],
  ['#ffe7a3', 51.06, 554.4, 3, 3],
  ['#f9cfdd', 334.94, 505.94, 3, 3],
  ['#FFFFFF', 152.54, 574.56, 3, 3],
  ['#e2d6f8', 238.44, 523.36, 3, 3],
  ['#ffe7a3', 67.93, 657.27, 3, 3],
  ['#f9cfdd', 161.52, 514.19, 3, 3],
  ['#FFFFFF', 196, 532.77, 3, 3],
  ['#e2d6f8', 62.22, 616.84, 3, 3],
  ['#ffe7a3', 129.58, 536.51, 3, 3],
  ['#f9cfdd', 37.08, 645.99, 3, 3],
  ['#FFFFFF', 91.14, 637.98, 3, 3],
  ['#e2d6f8', 170.04, 514.85, 3, 3],
  ['#ffe7a3', 215.01, 546.33, 3, 3],
  ['#f9cfdd', 268.02, 594.04, 3, 3],
  ['#FFFFFF', 56.24, 512.54, 3, 3],
  ['#e2d6f8', 163.13, 487.14, 3, 3],
  ['#ffe7a3', 26.2, 548.33, 3, 3],
  ['#f9cfdd', 241.52, 592.91, 3, 3],
  ['#FFFFFF', 334.76, 531.74, 3, 3],
  ['#e2d6f8', 159.01, 564.2, 3, 3],
  ['#ffe7a3', 159.2, 629.3, 3, 3],
  ['#f9cfdd', 163.25, 553.47, 3, 3],
];
export function DayScreen({
  children,
  home = false,
}: PropsWithChildren<{ home?: boolean }>) {
  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={StyleSheet.absoluteFill}
      >
        {[...layers, ...(home ? homeLayers : [])].map(
          ([source, x, y, w, h], index) => (
            <Image
              key={index}
              source={source}
              contentFit="fill"
              style={{
                position: 'absolute',
                left: `${(x / 360) * 100}%`,
                top: `${(y / 780) * 100}%`,
                width: `${(w / 360) * 100}%`,
                height: `${(h / 780) * 100}%`,
              }}
            />
          ),
        )}
        {home &&
          homeDetails.map(([color, x, y, w, h], index) => (
            <View
              key={index}
              style={{
                position: 'absolute',
                backgroundColor: color,
                left: `${(x / 360) * 100}%`,
                top: `${(y / 780) * 100}%`,
                width: `${(w / 360) * 100}%`,
                height: `${(h / 780) * 100}%`,
              }}
            />
          ))}
      </View>
      <SafeAreaView style={styles.safe}>{children}</SafeAreaView>
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#D8DFFF' },
  safe: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' },
});

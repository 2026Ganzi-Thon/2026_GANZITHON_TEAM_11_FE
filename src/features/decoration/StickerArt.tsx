import { Image } from 'expo-image';
import { View } from 'react-native';
import type { StickerShape } from './types';
export function StickerArt({
  shape,
  onError,
  testID,
}: {
  shape: StickerShape;
  onError?: () => void;
  testID?: string;
}) {
  if (shape === 'diamond')
    return (
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 4,
          backgroundColor: '#AFC0FF',
          transform: [{ rotate: '-45deg' }],
        }}
      />
    );
  const art = {
    star: require('../../../assets/images/stickers/star.svg'),
    circle: require('../../../assets/images/stickers/circle.svg'),
    triangle: require('../../../assets/images/stickers/triangle.svg'),
    sparkle: require('../../../assets/images/stickers/sparkle.svg'),
  };
  const w = shape === 'star' ? 20.9232 : shape === 'triangle' ? 19.0526 : 22,
    h = shape === 'star' ? 19.8992 : shape === 'triangle' ? 16.5 : 22;
  return (
    <View style={{ width: 22, height: 22 }}>
      <Image
        testID={testID}
        source={art[shape]}
        onError={onError}
        accessible={false}
        contentFit="contain"
        style={{
          position: 'absolute',
          left: (22 - w) / 2,
          top: 0,
          width: w,
          height: h,
        }}
      />
    </View>
  );
}

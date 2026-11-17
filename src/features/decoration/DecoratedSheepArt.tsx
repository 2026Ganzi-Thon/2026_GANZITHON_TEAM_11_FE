import { View } from 'react-native';
import { Image } from 'expo-image';
import { sheepArtwork } from '../morning/SheepArt';
import { StickerArt } from './StickerArt';
import type { Sheep } from '../morning/types';
import { mockStickerShape } from './catalog';
/** Editor and flock use the same 130×103 coordinate space, scaled as one layer. */
export function DecoratedSheepArt({
  sheep,
  large = false,
  editor = false,
}: {
  sheep: Sheep;
  large?: boolean;
  editor?: boolean;
}) {
  const width = editor ? 130 : large ? 52.8 : 33,
    height = editor ? 103 : large ? 44 : 27.5;
  return (
    <View
      style={{ width, height }}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={{
          position: 'absolute',
          width: 130,
          height: 103,
          left: (width - 130) / 2,
          top: (height - 103) / 2,
          transform: [{ scale: width / 130 }],
        }}
      >
        <Image
          accessible={false}
          source={sheepArtwork(sheep.color_key)}
          contentFit="contain"
          style={{ width: 130, height: 103 }}
        />
        {!editor &&
          sheep.placements?.map((p) => {
            const shape = mockStickerShape(p.sticker_id);
            return shape ? (
              <View
                key={p.instance_id}
                style={{
                  position: 'absolute',
                  left: p.x * 130 - 11,
                  top: p.y * 103 - 11,
                  width: 22,
                  height: 22,
                  transform: [
                    { rotate: `${p.rotation}deg` },
                    { scale: p.scale },
                  ],
                }}
              >
                <StickerArt shape={shape} />
              </View>
            ) : null;
          })}
      </View>
    </View>
  );
}

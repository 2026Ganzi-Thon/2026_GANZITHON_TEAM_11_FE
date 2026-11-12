import { Image } from 'expo-image';

// Category keys already used by the worry picker; unknown keys stay neutral.
const artwork: Record<string, number> = {
  career: require('../../../assets/images/morning/sheep-yellow.svg'),
  health: require('../../../assets/images/morning/sheep-green.svg'),
  relationships: require('../../../assets/images/morning/sheep-purple.svg'),
  romance: require('../../../assets/images/morning/sheep-pink.svg'),
};
export function SheepArt({
  colorKey,
  large = false,
}: {
  colorKey: string | null;
  large?: boolean;
}) {
  return (
    <Image
      accessible={false}
      source={
        colorKey !== null && Object.hasOwn(artwork, colorKey)
          ? artwork[colorKey]
          : require('../../../assets/images/morning/sheep-neutral.svg')
      }
      contentFit="contain"
      style={{ width: large ? 52.8 : 33, height: large ? 44 : 27.5 }}
    />
  );
}

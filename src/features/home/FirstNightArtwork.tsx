import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { dayLayers, homeLayers, homeDetails } from '../morning/DayScreen';

export function FirstNightArtwork({
  scale,
  pasture = false,
}: {
  scale: number;
  pasture?: boolean;
}) {
  const origin = pasture ? 364 : 0;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
    >
      {(pasture ? homeLayers : dayLayers.slice(0, 10)).map(
        ([source, x, y, width, height], index) => (
          <Image
            key={index}
            source={source}
            contentFit="contain"
            style={{
              position: 'absolute',
              left: x * scale,
              top: (y - origin) * scale,
              width: width * scale,
              height: height * scale,
            }}
          />
        ),
      )}
      {pasture &&
        homeDetails.map(([backgroundColor, x, y, width, height], index) => (
          <View
            key={index}
            style={{
              position: 'absolute',
              backgroundColor,
              left: x * scale,
              top: (y - origin) * scale,
              width: width * scale,
              height: height * scale,
            }}
          />
        ))}
    </View>
  );
}

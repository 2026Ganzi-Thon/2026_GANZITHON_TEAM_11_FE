import { useState, type PropsWithChildren } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Image, type ImageSource } from 'expo-image';
/** Repeat only the straight middle of the original asset; keep pixel corners unscaled vertically. */
function Slice({
  source,
  width,
  height,
  originalWidth,
  originalHeight,
}: {
  source: ImageSource | number;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
}) {
  const scale = width / originalWidth,
    h = originalHeight * scale,
    cap = 12 * scale,
    middle = Math.max(0, height - 2 * cap),
    tile = h - 2 * cap;
  const piece = (top: number, size: number, offset: number, key: string) => (
    <View
      key={key}
      style={{
        position: 'absolute',
        left: 0,
        top,
        width,
        height: size,
        overflow: 'hidden',
      }}
    >
      <Image
        source={source}
        contentFit="contain"
        style={{ position: 'absolute', left: 0, top: offset, width, height: h }}
        accessible={false}
      />
    </View>
  );
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {piece(0, cap, 0, 'top')}
      {Array.from({ length: Math.ceil(middle / tile) }, (_, i) =>
        piece(
          cap + i * tile,
          Math.min(tile, middle - i * tile),
          -cap,
          'mid' + i,
        ),
      )}
      {piece(height - cap, cap, -(h - cap), 'bottom')}
    </View>
  );
}
export function PixelPanel({
  children,
  width,
  source,
  originalWidth,
  originalHeight,
  style,
  glow = false,
  shadow,
}: {
  width: number;
  source: ImageSource | number;
  originalWidth: number;
  originalHeight: number;
  style?: StyleProp<ViewStyle>;
  glow?: boolean;
  shadow?: ImageSource | number;
} & PropsWithChildren) {
  const scale = width / originalWidth,
    [height, setHeight] = useState(originalHeight * scale);
  return (
    <View
      style={[{ width, minHeight: originalHeight * scale }, style]}
      onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
    >
      {shadow && (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, top: 4, width, height }}
        >
          <Slice
            source={shadow}
            width={width}
            height={height}
            originalWidth={originalWidth}
            originalHeight={originalHeight}
          />
        </View>
      )}
      {glow &&
        [
          [
            require('../../../assets/images/worry-selection/glow-outer.svg'),
            318,
            250,
            9,
          ],
          [
            require('../../../assets/images/worry-selection/glow-mid.svg'),
            312,
            244,
            6,
          ],
          [
            require('../../../assets/images/worry-selection/glow-inner.svg'),
            306,
            238,
            3,
          ],
        ].map(([asset, w, h, inset], i) => (
          <View
            key={i}
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -Number(inset) * scale,
              left: -Number(inset) * scale,
              width: Number(w) * scale,
              height: height + 2 * Number(inset) * scale,
            }}
          >
            <Slice
              source={asset as number}
              width={Number(w) * scale}
              height={height + 2 * Number(inset) * scale}
              originalWidth={Number(w)}
              originalHeight={Number(h)}
            />
          </View>
        ))}
      <Slice
        source={source}
        width={width}
        height={height}
        originalWidth={originalWidth}
        originalHeight={originalHeight}
      />
      {children}
    </View>
  );
}

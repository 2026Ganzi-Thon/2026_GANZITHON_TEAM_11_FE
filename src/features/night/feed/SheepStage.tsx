import { useMemo } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';
import { Art } from './artwork';
import { swipeDirection } from './model';

export function SheepStage({
  progress,
  direction,
  onMove,
}: {
  progress: Animated.Value;
  direction: -1 | 1;
  onMove: (direction: -1 | 1) => void;
}) {
  const responder = useMemo(
    () =>
      PanResponder.create({
        // Reserve only this dedicated area from touch-down; grant resets dx/dy.
        onStartShouldSetPanResponder: () => true,
        onPanResponderRelease: (_event, gesture) => {
          const delta = swipeDirection(gesture.dx, gesture.dy);
          if (delta) onMove(delta);
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [onMove],
  );
  return (
    <View
      {...responder.panHandlers}
      style={styles.stage}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="양 이동 영역"
      accessibilityHint="위로 넘기면 다음 양, 아래로 넘기면 이전 양이에요"
      accessibilityActions={[
        { name: 'increment', label: '다음 양' },
        { name: 'decrement', label: '이전 양' },
      ]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'increment') onMove(1);
        if (event.nativeEvent.actionName === 'decrement') onMove(-1);
      }}
    >
      <View style={styles.ground} />
      <View style={styles.fence} pointerEvents="none">
        {[4, 20, 36, 52, 68].map((left) => (
          <View key={left} style={[styles.post, { left }]} />
        ))}
        <View style={[styles.rail, { top: 8 }]} />
        <View style={[styles.rail, { top: 24 }]} />
      </View>
      <Art
        source={require('../../../../assets/images/feed/left-sheep.svg')}
        x={30}
        y={50}
        width={60}
        height={50}
      />
      <Art
        source={require('../../../../assets/images/feed/right-sheep.svg')}
        x={250}
        y={58}
        width={48}
        height={40}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.jumper,
          {
            transform: [
              {
                translateX: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: direction === 1 ? [-95, 95] : [95, -95],
                }),
              },
              {
                translateY: progress.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [50, 6, 50],
                }),
              },
              { scaleX: direction },
            ],
          },
        ]}
      >
        <Art
          source={require('../../../../assets/images/feed/jump-sheep.svg')}
          x={0}
          y={0}
          width={60}
          height={50}
        />
      </Animated.View>
    </View>
  );
}
const styles = StyleSheet.create({
  stage: { width: 318, height: 110, alignSelf: 'center', overflow: 'hidden' },
  ground: {
    position: 'absolute',
    left: 0,
    top: 98,
    width: 318,
    height: 2,
    backgroundColor: '#4A55B8',
  },
  fence: { position: 'absolute', left: 124, top: 56, width: 80, height: 42 },
  post: {
    position: 'absolute',
    top: 0,
    width: 6,
    height: 42,
    borderRadius: 2,
    backgroundColor: '#4A55B8',
  },
  rail: {
    position: 'absolute',
    left: 0,
    width: 80,
    height: 4,
    backgroundColor: '#4A55B8',
  },
  jumper: { position: 'absolute', left: 130, top: 0, width: 60, height: 50 },
});

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, AppState, Easing } from 'react-native';

export function SheepArrival({
  active,
  ready,
  reducedMotion,
  scale,
  children,
}: {
  active: boolean;
  ready: boolean;
  reducedMotion: boolean;
  scale: number;
  children: ReactNode;
}) {
  const [progress] = useState(
    () => new Animated.Value(active && !reducedMotion ? 0 : 1),
  );
  const consumed = useRef(false);
  const animation = useRef<Animated.CompositeAnimation | null>(null);
  useEffect(() => {
    const settle = () => {
      consumed.current = true;
      animation.current?.stop();
      animation.current = null;
      progress.setValue(1);
    };
    if (!active || reducedMotion || (consumed.current && !ready)) settle();
    else if (ready && !consumed.current) {
      consumed.current = true;
      animation.current = Animated.timing(progress, {
        toValue: 1,
        duration: 640,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      });
      animation.current.start();
    }
  }, [active, ready, reducedMotion, progress]);
  useEffect(() => {
    if (!active) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') return;
      consumed.current = true;
      animation.current?.stop();
      animation.current = null;
      progress.setValue(1);
    });
    return () => {
      animation.current?.stop();
      subscription.remove();
    };
  }, [active, progress]);
  return (
    <Animated.View
      style={{
        opacity: progress.interpolate({
          inputRange: [0, 0.14, 1],
          outputRange: [0, 1, 1],
        }),
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 0.68, 0.84, 1],
              outputRange: [-56 * scale, 0, -4 * scale, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

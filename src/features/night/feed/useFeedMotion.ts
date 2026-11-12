import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';
export function useFeedMotion() {
  const [progress] = useState(() => new Animated.Value(0.5));
  const [direction, setDirection] = useState<-1 | 1>(1);
  const [moving, setMoving] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(true);
  const reduced = useRef(false);
  const generation = useRef(0);
  const active = useRef<Animated.CompositeAnimation | null>(null);
  const cancel = useCallback(() => {
    generation.current++;
    active.current?.stop();
    active.current = null;
    busy.current = false;
    progress.setValue(0.5);
    if (mounted.current) setMoving(false);
  }, [progress]);
  useEffect(() => {
    mounted.current = true;
    let preferenceChanged = false;
    let disposed = false;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (!disposed && !preferenceChanged) reduced.current = value;
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (value) => {
        preferenceChanged = true;
        reduced.current = value;
      },
    );
    return () => {
      disposed = true;
      mounted.current = false;
      cancel();
      subscription.remove();
    };
  }, [cancel]);
  const run = useCallback(
    (nextDirection: -1 | 1, commit: () => void) => {
      if (busy.current || !mounted.current) return;
      if (reduced.current) {
        commit();
        return;
      }
      busy.current = true;
      setMoving(true);
      setDirection(nextDirection);
      progress.setValue(0);
      const token = ++generation.current;
      const animation = Animated.timing(progress, {
        toValue: 1,
        duration: 420,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      });
      active.current = animation;
      animation.start(({ finished }) => {
        if (!mounted.current || token !== generation.current) return;
        active.current = null;
        busy.current = false;
        setMoving(false);
        progress.setValue(0.5);
        if (finished) commit();
      });
    },
    [progress],
  );
  return { progress, direction, moving, run, cancel };
}

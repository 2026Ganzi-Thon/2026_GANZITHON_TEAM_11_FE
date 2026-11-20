import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing } from 'react-native';

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}
/** Independent, bounded routes in each sheep's local pasture coordinates. */
export function wanderRoute(id: string, bounds: Bounds) {
  let seed = 2166136261;
  for (const char of id)
    seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  const random = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  let previous = { x: 0, y: 0 };
  return Array.from({ length: 5 }, (_, index) => {
    const point =
      index === 4
        ? { x: 0, y: 0 }
        : {
            x: bounds.minX + random() * (bounds.maxX - bounds.minX),
            y: bounds.minY + random() * (bounds.maxY - bounds.minY),
          };
    const duration = Math.round(
      4500 + Math.hypot(point.x - previous.x, point.y - previous.y) * 170,
    );
    previous = point;
    return { ...point, duration, rest: 600 + Math.round(random() * 1600) };
  });
}

/** Read the system preference and foreground state once per pasture, not per sheep. */
export function usePastureMotion(visible = true) {
  const [reduced, setReduced] = useState(true);
  const [foreground, setForeground] = useState(
    () =>
      AppState.currentState !== 'background' &&
      AppState.currentState !== 'inactive',
  );
  useEffect(() => {
    let active = true,
      changed = false;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active && !changed) setReduced(value);
      })
      .catch(() => {});
    const preference = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (value) => {
        changed = true;
        setReduced(value);
      },
    );
    const state = AppState.addEventListener('change', (value) =>
      setForeground(value === 'active'),
    );
    return () => {
      active = false;
      preference.remove();
      state.remove();
    };
  }, []);
  return visible && foreground && !reduced;
}

export function SheepWander({
  id,
  bounds,
  enabled,
  delayMs = 0,
  children,
}: {
  id: string;
  bounds: Bounds;
  enabled: boolean;
  delayMs?: number;
  children: ReactNode;
}) {
  const [progress] = useState(() => new Animated.Value(0));
  const { minX, maxX, minY, maxY } = bounds;
  const route = useMemo(
    () => wanderRoute(id, { minX, maxX, minY, maxY }),
    [id, minX, maxX, minY, maxY],
  );
  const path = useMemo(() => {
    const inputRange = [0],
      x = [0],
      y = [0];
    let elapsed = 0;
    for (const point of route) {
      elapsed += point.rest;
      inputRange.push(elapsed);
      x.push(x[x.length - 1]);
      y.push(y[y.length - 1]);
      elapsed += point.duration;
      inputRange.push(elapsed);
      x.push(point.x);
      y.push(point.y);
    }
    return {
      inputRange: inputRange.map((time) => time / elapsed),
      x,
      y,
      duration: elapsed,
    };
  }, [route]);
  useEffect(() => {
    if (!enabled) return;
    // One native timeline includes both walking and rests, without JS frame timers.
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: path.duration,
        easing: Easing.linear,
        useNativeDriver: true,
        isInteraction: false,
      }),
      { iterations: -1 },
    );
    const timer = delayMs > 0 ? setTimeout(() => loop.start(), delayMs) : null;
    if (timer === null) loop.start();
    return () => {
      if (timer !== null) clearTimeout(timer);
      loop.stop();
    };
  }, [enabled, path, progress, delayMs]);
  return (
    <Animated.View
      style={{
        transform: [
          {
            translateX: progress.interpolate({
              inputRange: path.inputRange,
              outputRange: path.x,
            }),
          },
          {
            translateY: progress.interpolate({
              inputRange: path.inputRange,
              outputRange: path.y,
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

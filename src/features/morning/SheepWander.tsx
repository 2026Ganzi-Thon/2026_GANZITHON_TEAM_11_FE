import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing } from 'react-native';

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}
interface WanderLeg {
  x: number;
  y: number;
  duration: number;
  rest: number;
  control?: { x: number; y: number };
}
/** Independent, bounded routes in each sheep's local pasture coordinates. */
export function wanderRoute(
  id: string,
  bounds: Bounds,
  variation = Math.floor(Math.random() * 4294967296),
): WanderLeg[] {
  let seed = (2166136261 ^ variation) >>> 0;
  for (const char of id)
    seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  const random = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const strollSpeed = 1.1 + random() * 3.8;
  const restChance = 0.25 + random() * 0.5;
  const firstRest = 700 + random() * 16000;
  let previous = { x: 0, y: 0 };
  return Array.from({ length: 24 }, (_, index) => {
    const point =
      index === 23
        ? { x: 0, y: 0 }
        : {
            x: bounds.minX + random() * (bounds.maxX - bounds.minX),
            y: bounds.minY + random() * (bounds.maxY - bounds.minY),
          };
    const control = {
      x: previous.x + (point.x - previous.x) * (0.2 + random() * 0.6),
      y: previous.y + (point.y - previous.y) * (0.2 + random() * 0.6),
    };
    const speed = strollSpeed * (0.75 + random() * 0.5);
    const duration = Math.max(
      4000,
      Math.round(
        (Math.hypot(point.x - previous.x, point.y - previous.y) / speed) * 1000,
      ),
    );
    previous = point;
    const rest =
      index === 0
        ? firstRest
        : random() < restChance
          ? 2500 + random() * 14000
          : 150 + random() * 650;
    return { ...point, control, duration, rest: Math.round(rest) };
  });
}

/** Native keyframes hold still while resting, then turn before the next walk. */
export function wanderTimeline(route: ReturnType<typeof wanderRoute>) {
  const inputRange = [0],
    x = [0],
    y = [0],
    face = [1];
  let elapsed = 0;
  for (const point of route) {
    const previousX = x[x.length - 1],
      previousY = y[y.length - 1];
    const previousFace = face[face.length - 1];
    const nextFace =
      point.x === previousX ? previousFace : point.x > previousX ? 1 : -1;
    elapsed += point.rest;
    inputRange.push(elapsed - 1, elapsed);
    x.push(previousX, previousX);
    y.push(previousY, previousY);
    face.push(previousFace, nextFace);
    const control = point.control ?? {
      x: (previousX + point.x) / 2,
      y: (previousY + point.y) / 2,
    };
    // Smooth acceleration/deceleration along a gently curved, bounded path.
    for (let sample = 1; sample <= 8; sample++) {
      const t = sample / 8;
      const u = t * t * (3 - 2 * t);
      inputRange.push(elapsed + point.duration * t);
      x.push(
        (1 - u) ** 2 * previousX +
          2 * (1 - u) * u * control.x +
          u ** 2 * point.x,
      );
      y.push(
        (1 - u) ** 2 * previousY +
          2 * (1 - u) * u * control.y +
          u ** 2 * point.y,
      );
      face.push(nextFace);
    }
    elapsed += point.duration;
  }
  return {
    inputRange: inputRange.map((time) => time / elapsed),
    x,
    y,
    face,
    duration: elapsed,
  };
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
  children:
    ReactNode | ((facing: Animated.AnimatedInterpolation<number>) => ReactNode);
}) {
  const [progress] = useState(() => new Animated.Value(0));
  const { minX, maxX, minY, maxY } = bounds;
  const route = useMemo(
    () => wanderRoute(id, { minX, maxX, minY, maxY }),
    [id, minX, maxX, minY, maxY],
  );
  const path = useMemo(() => wanderTimeline(route), [route]);
  const facing = useMemo(
    () =>
      progress.interpolate({
        inputRange: path.inputRange,
        outputRange: path.face,
      }),
    [progress, path],
  );
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
      {typeof children === 'function' ? children(facing) : children}
    </Animated.View>
  );
}

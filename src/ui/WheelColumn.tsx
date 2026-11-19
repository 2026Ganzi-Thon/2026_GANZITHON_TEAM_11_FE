import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { selectionFeedback } from './selectionFeedback';
import { theme } from './theme';
export function WheelColumn({
  label,
  values,
  value,
  format,
  rowHeight,
  disabled,
  onChange,
  wrap = false,
}: {
  label: string;
  values: readonly number[];
  value: number;
  format: (value: number) => string;
  rowHeight: number;
  disabled: boolean;
  onChange: (value: number) => void;
  wrap?: boolean;
}) {
  const [offset] = useState(() => new Animated.Value(0));
  const animation = useRef<Animated.CompositeAnimation | null>(null),
    busy = useRef(false),
    reduced = useRef(true);
  const settle = useCallback(() => {
    animation.current?.stop();
    animation.current = null;
    busy.current = false;
    offset.setValue(0);
  }, [offset]);
  useEffect(() => {
    let disposed = false,
      changed = false;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (!disposed && !changed) reduced.current = v;
      })
      .catch(() => {});
    const listener = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (v) => {
        changed = true;
        reduced.current = v;
        if (v) settle();
      },
    );
    return () => {
      disposed = true;
      listener.remove();
      settle();
    };
  }, [settle]);
  useEffect(() => {
    if (disabled) settle();
  }, [disabled, settle]);
  const move = useCallback(
    (direction: number) => {
      if (disabled || busy.current) return;
      const index = values.indexOf(value),
        step = Math.sign(direction);
      const nextIndex = wrap
        ? (index + step + values.length) % values.length
        : Math.max(0, Math.min(values.length - 1, index + step));
      if (!step || values[nextIndex] === value) {
        settle();
        return;
      }
      onChange(values[nextIndex]);
      selectionFeedback();
      if (reduced.current) {
        offset.setValue(0);
        return;
      }
      busy.current = true;
      offset.setValue(step * rowHeight * 0.4);
      const spring = Animated.spring(offset, {
        toValue: 0,
        stiffness: 220,
        damping: 19,
        mass: 0.65,
        useNativeDriver: true,
      });
      animation.current = spring;
      spring.start(() => {
        if (animation.current === spring) {
          animation.current = null;
          busy.current = false;
          offset.setValue(0);
        }
      });
    },
    [disabled, values, value, wrap, onChange, offset, rowHeight, settle],
  );
  const onPanMove = useCallback(
    (_event: unknown, g: { dx: number; dy: number }) => {
      if (!disabled && !busy.current && !reduced.current)
        offset.setValue(
          Math.max(-rowHeight * 0.35, Math.min(rowHeight * 0.35, g.dy * 0.25)),
        );
    },
    [disabled, offset, rowHeight],
  );
  const onPanRelease = useCallback(
    (
      event: { nativeEvent: { locationY: number } },
      g: { dx: number; dy: number },
    ) => {
      if (disabled || busy.current) return;
      if (
        Math.abs(g.dy) >= Math.max(14, rowHeight * 0.45) &&
        Math.abs(g.dy) > Math.abs(g.dx) * 1.2
      )
        move(-Math.sign(g.dy));
      else if (Math.abs(g.dx) <= 8 && Math.abs(g.dy) <= 8)
        move(
          Math.sign(Math.floor(event.nativeEvent.locationY / rowHeight) - 2),
        );
      else settle();
    },
    [disabled, move, rowHeight, settle],
  );
  const pan = useMemo(
    () =>
      // PanResponder stores these callbacks; ref reads occur only on gesture events.
      // eslint-disable-next-line react-hooks/refs
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: onPanMove,
        onPanResponderRelease: onPanRelease,
        onPanResponderTerminate: settle,
      }),
    [disabled, onPanMove, onPanRelease, settle],
  );
  const index = values.indexOf(value);
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      accessibilityValue={{
        min: values[0],
        max: values[values.length - 1],
        now: value,
        text: format(value),
      }}
      accessibilityActions={[
        { name: 'increment', label: '다음 값' },
        { name: 'decrement', label: '이전 값' },
      ]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'increment') move(1);
        if (e.nativeEvent.actionName === 'decrement') move(-1);
      }}
      style={styles.column}
    >
      <Animated.View
        {...pan.panHandlers}
        style={{ transform: [{ translateY: offset }] }}
      >
        {[-2, -1, 0, 1, 2].map((delta) => {
          const at = index + delta;
          const shown = wrap
            ? values[(at + values.length) % values.length]
            : values[at];
          return (
            <View
              key={delta}
              accessible={false}
              pointerEvents="none"
              style={[styles.row, { height: rowHeight }]}
            >
              <Text
                style={[
                  styles.value,
                  {
                    fontSize:
                      delta === 0 ? 18 : Math.abs(delta) === 1 ? 15 : 13,
                  },
                  delta === 0 && styles.selected,
                ]}
              >
                {shown === undefined || (values.length === 2 && delta !== 0)
                  ? ' '
                  : format(shown)}
              </Text>
            </View>
          );
        })}
      </Animated.View>
    </View>
  );
}
const styles = StyleSheet.create({
  column: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    borderRightWidth: 1,
    borderRightColor: '#46519F',
  },
  row: {
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(195,201,240,0.12)',
  },
  value: {
    fontFamily: theme.font,
    color: theme.color.muted,
    lineHeight: 26,
    textAlign: 'center',
  },
  selected: { color: theme.color.text, fontWeight: '700' },
});

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
} from 'react';
import {
  AccessibilityInfo,
  ScrollView,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { selectionFeedback } from './selectionFeedback';
import { theme } from './theme';

const WRAP_CYCLES = 101;
const CENTER_CYCLE = 50;
type ScrollEvent = NativeSyntheticEvent<NativeScrollEvent>;
export function WheelColumn({
  label,
  values,
  value,
  format,
  rowHeight,
  disabled,
  fontFamily = theme.font,
  textScale = 1,
  onChange,
  wrap = false,
}: {
  label: string;
  values: readonly number[];
  value: number;
  format: (value: number) => string;
  rowHeight: number;
  disabled: boolean;
  fontFamily?: string;
  textScale?: number;
  onChange: (value: number) => void;
  wrap?: boolean;
}) {
  const count = values.length;
  const index = Math.max(0, values.indexOf(value));
  const initialIndex = index + (wrap ? count * CENTER_CYCLE : 0);
  const data = useMemo(
    () =>
      wrap ? Array.from({ length: WRAP_CYCLES }, () => values).flat() : values,
    [values, wrap],
  );
  const list = useRef<ComponentRef<typeof ScrollView>>(null);
  const [reduced, setReduced] = useState(true);
  const [initialOffset] = useState(() => ({
    x: 0,
    y: initialIndex * rowHeight,
  }));
  const [windowCenter, setWindowCenter] = useState(initialIndex);
  const pendingTap = useRef<number | null>(null);
  const ensureWindow = useCallback((at: number) => setWindowCenter(at), []);
  const selected = useRef(value);
  const dragging = useRef(false);
  const position = useRef(initialIndex * rowHeight);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const layoutKey = `${rowHeight}:${wrap}:${values.join(',')}`;
  const previousLayout = useRef(layoutKey);
  const wasDisabled = useRef(disabled);
  const clearSettle = useCallback(() => {
    if (settleTimer.current !== null) clearTimeout(settleTimer.current);
    settleTimer.current = null;
  }, []);
  useEffect(() => {
    let disposed = false,
      changed = false;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (!disposed && !changed) setReduced(v);
      })
      .catch(() => {});
    const listener = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (v) => {
        changed = true;
        setReduced(v);
      },
    );
    return () => {
      disposed = true;
      listener.remove();
      clearSettle();
    };
  }, [clearSettle]);
  useLayoutEffect(() => {
    if (
      selected.current !== value ||
      previousLayout.current !== layoutKey ||
      (disabled && !wasDisabled.current)
    ) {
      clearSettle();
      dragging.current = false;
      pendingTap.current = null;
      ensureWindow(initialIndex);
      selected.current = value;
      position.current = initialIndex * rowHeight;
      list.current?.scrollTo({
        y: position.current,
        animated: false,
      });
    }
    previousLayout.current = layoutKey;
    wasDisabled.current = disabled;
  }, [
    value,
    layoutKey,
    disabled,
    initialIndex,
    rowHeight,
    clearSettle,
    ensureWindow,
  ]);
  const nearest = useCallback(
    (y: number) =>
      Math.max(0, Math.min(data.length - 1, Math.round(y / rowHeight))),
    [data.length, rowHeight],
  );
  const publish = useCallback(
    (at: number) => {
      const next = data[at];
      if (disabled || next === undefined || next === selected.current) return;
      selected.current = next;
      onChange(next);
      selectionFeedback();
    },
    [data, disabled, onChange],
  );
  const finish = useCallback(
    (y: number) => {
      clearSettle();
      if (disabled || (!dragging.current && pendingTap.current === null))
        return;
      const at = pendingTap.current ?? nearest(y);
      publish(at);
      dragging.current = false;
      pendingTap.current = null;
      // Recenter cyclic time columns only once motion has finished, with the same visible values.
      const centered = wrap ? count * CENTER_CYCLE + (at % count) : at;
      ensureWindow(centered);
      position.current = centered * rowHeight;
      list.current?.scrollTo({
        y: position.current,
        animated: false,
      });
    },
    [
      clearSettle,
      disabled,
      nearest,
      publish,
      wrap,
      count,
      rowHeight,
      ensureWindow,
    ],
  );
  const select = useCallback(
    (at: number) => {
      if (disabled) return;
      clearSettle();
      dragging.current = false;
      pendingTap.current = at;
      ensureWindow(at);
      publish(at);
      position.current = at * rowHeight;
      list.current?.scrollTo({
        y: position.current,
        animated: !reduced,
      });
      if (reduced) finish(position.current);
      else settleTimer.current = setTimeout(() => finish(at * rowHeight), 500);
    },
    [disabled, clearSettle, publish, rowHeight, reduced, ensureWindow, finish],
  );
  const trackScroll = useCallback(
    (e: ScrollEvent) => {
      position.current = e.nativeEvent.contentOffset.y;
      ensureWindow(nearest(position.current));
      if (dragging.current) publish(nearest(position.current));
    },
    [nearest, publish, ensureWindow],
  );
  const start = Math.max(0, Math.min(data.length - 1, windowCenter) - 12);
  const end = Math.min(data.length, start + 25);
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      accessibilityValue={{
        min: values[0],
        max: values[count - 1],
        now: value,
        text: format(value),
      }}
      accessibilityActions={[
        { name: 'increment', label: '다음 값' },
        { name: 'decrement', label: '이전 값' },
      ]}
      onAccessibilityAction={(e) => {
        const step =
          e.nativeEvent.actionName === 'increment'
            ? 1
            : e.nativeEvent.actionName === 'decrement'
              ? -1
              : 0;
        if (!step) return;
        const at = values.indexOf(selected.current) + step;
        select(
          wrap
            ? count * CENTER_CYCLE + ((at + count) % count)
            : Math.max(0, Math.min(count - 1, at)),
        );
      }}
      style={[styles.column, { height: rowHeight * 5 }]}
    >
      <ScrollView
        ref={list}
        testID={`wheel-${label}`}
        contentOffset={initialOffset}
        contentContainerStyle={{ paddingVertical: rowHeight * 2 }}
        scrollEnabled={!disabled}
        showsVerticalScrollIndicator={false}
        snapToInterval={rowHeight}
        disableIntervalMomentum
        decelerationRate="fast"
        bounces={false}
        overScrollMode="never"
        nestedScrollEnabled
        scrollEventThrottle={16}
        onScrollBeginDrag={() => {
          clearSettle();
          dragging.current = !disabled;
          pendingTap.current = null;
        }}
        onScroll={trackScroll}
        onScrollEndDrag={() => {
          clearSettle();
          // Native snap can end without momentum. Delay that fallback so a real fling keeps scrolling.
          settleTimer.current = setTimeout(() => finish(position.current), 180);
        }}
        onMomentumScrollBegin={clearSettle}
        onMomentumScrollEnd={(e) => finish(e.nativeEvent.contentOffset.y)}
      >
        <View style={{ height: start * rowHeight }} />
        {data.slice(start, end).map((item, localIndex) => {
          const at = start + localIndex;
          const distance = Math.min(2, Math.abs(at - windowCenter));
          const fontSize = [18, 15, 13][distance] * textScale;
          return (
            <Pressable
              key={at}
              accessible={false}
              disabled={disabled}
              onPress={() => select(at)}
              style={[styles.row, { height: rowHeight }]}
            >
              <Text
                style={[
                  styles.value,
                  {
                    fontFamily,
                    fontSize,
                    lineHeight: Math.ceil(fontSize * 1.5),
                    color: ['#EEF0FF', '#C3C9F0', '#8F98D6'][distance],
                  },
                  distance === 0 && styles.selected,
                ]}
              >
                {format(item)}
              </Text>
            </Pressable>
          );
        })}
        <View style={{ height: (data.length - end) * rowHeight }} />
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  column: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  row: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  selected: { fontWeight: '700' },
  value: {
    fontFamily: theme.font,
    color: theme.color.text,
    fontSize: 18,
    fontWeight: '400',
    lineHeight: 26,
    textAlign: 'center',
  },
});

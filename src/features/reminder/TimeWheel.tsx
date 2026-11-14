import { useCallback, useMemo } from 'react';
import {
  PanResponder,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { theme } from '../../ui/theme';
import type { TimeParts } from './time';
function Column({
  label,
  values,
  value,
  format,
  rowHeight,
  disabled,
  onChange,
}: {
  label: string;
  values: readonly number[];
  value: number;
  format: (v: number) => string;
  rowHeight: number;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  const index = values.indexOf(value);
  const at = (offset: number) =>
    values[
      (((index + offset) % values.length) + values.length) % values.length
    ];
  const move = useCallback(
    (offset: number) => {
      if (!disabled)
        onChange(
          values[
            (((index + offset) % values.length) + values.length) % values.length
          ],
        );
    },
    [disabled, index, onChange, values],
  );
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: (event, gesture) => {
          if (
            Math.abs(gesture.dy) > 8 &&
            Math.abs(gesture.dy) > Math.abs(gesture.dx)
          )
            move(-Math.round(gesture.dy / rowHeight));
          else if (Math.abs(gesture.dy) <= 8 && Math.abs(gesture.dx) <= 8)
            move(
              Math.max(
                -2,
                Math.min(
                  2,
                  Math.floor(event.nativeEvent.locationY / rowHeight) - 2,
                ),
              ),
            );
        },
      }),
    [disabled, move, rowHeight],
  );
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      accessibilityValue={{ now: value, text: format(value) }}
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
      <View {...pan.panHandlers}>
        {[-2, -1, 0, 1, 2].map((offset) => (
          <View
            key={offset}
            accessible={false}
            pointerEvents="none"
            style={[styles.row, { height: rowHeight }]}
          >
            <Text
              style={[
                styles.value,
                { fontSize: offset === 0 ? 18 : 15 },
                offset === 0 && styles.selected,
              ]}
            >
              {values.length === 2 && offset !== 0 ? ' ' : format(at(offset))}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
const periods = [0, 1],
  hours = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  minutes = [0, 15, 30, 45];
export function TimeWheel({
  value,
  disabled,
  onChange,
}: {
  value: TimeParts;
  disabled: boolean;
  onChange: (part: keyof TimeParts, value: number) => void;
}) {
  const { fontScale } = useWindowDimensions();
  const rowHeight = Math.max(34, Math.ceil(28 * fontScale));
  return (
    <View
      style={[
        styles.picker,
        { height: rowHeight * 5 + 10 },
        disabled && styles.dim,
      ]}
    >
      <View
        pointerEvents="none"
        style={[styles.band, { top: rowHeight * 2 + 2, height: rowHeight + 6 }]}
      />
      <Column
        label="알림 오전·오후"
        values={periods}
        value={value.period}
        format={(v) => (v ? '오후' : '오전')}
        rowHeight={rowHeight}
        disabled={disabled}
        onChange={(v) => onChange('period', v)}
      />
      <Column
        label="알림 시"
        values={hours}
        value={value.hour}
        format={String}
        rowHeight={rowHeight}
        disabled={disabled}
        onChange={(v) => onChange('hour', v)}
      />
      <Column
        label="알림 분"
        values={minutes}
        value={value.minute}
        format={(v) => String(v).padStart(2, '0')}
        rowHeight={rowHeight}
        disabled={disabled}
        onChange={(v) => onChange('minute', v)}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  picker: {
    flexDirection: 'row',
    paddingVertical: 5,
    borderRadius: 4,
    backgroundColor: '#2B3591',
    boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
  },
  column: { flex: 1, minWidth: 0 },
  row: { justifyContent: 'center', alignItems: 'center' },
  value: {
    fontFamily: theme.font,
    color: theme.color.muted,
    textAlign: 'center',
    lineHeight: 26,
  },
  selected: { color: theme.color.text, fontWeight: '700' },
  band: {
    position: 'absolute',
    left: 12,
    right: 12,
    borderWidth: 1,
    borderRadius: 4,
    borderColor: '#4A5BC2',
    backgroundColor: '#1E2063',
  },
  dim: { opacity: 0.65 },
});

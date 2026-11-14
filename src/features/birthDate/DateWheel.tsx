import { useCallback, useMemo } from 'react';
import {
  PanResponder,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { theme } from '../../ui/theme';
import { daysInMonth, type DateParts } from './date';
function Column({
  label,
  value,
  min,
  max,
  unit,
  rowHeight,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  rowHeight: number;
  onChange: (value: number) => void;
  disabled: boolean;
}) {
  const move = useCallback(
    (amount: number) => {
      if (!disabled) onChange(Math.max(min, Math.min(max, value + amount)));
    },
    [disabled, min, max, value, onChange],
  );
  const pan = useMemo(
    () =>
      PanResponder.create({
        // Claim touches inside the wheel before the outer ScrollView starts.
        onStartShouldSetPanResponder: () => !disabled,
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: (event, g) => {
          if (disabled) return;
          if (Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx)) {
            move(-Math.round(g.dy / rowHeight));
          } else if (Math.abs(g.dx) <= 8 && Math.abs(g.dy) <= 8) {
            move(
              Math.max(
                -2,
                Math.min(
                  2,
                  Math.floor(event.nativeEvent.locationY / rowHeight) - 2,
                ),
              ),
            );
          }
        },
      }),
    [disabled, move, rowHeight],
  );
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value, text: `${value}${unit}` }}
      accessibilityState={{ disabled }}
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
                {
                  fontSize:
                    offset === 0 ? 18 : Math.abs(offset) === 1 ? 15 : 13,
                  lineHeight: 26,
                },
                offset === 0 && styles.selected,
              ]}
            >
              {value + offset >= min && value + offset <= max
                ? `${value + offset}${unit}`
                : ' '}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
export function DateWheel({
  value,
  todayYear,
  disabled,
  onChange,
}: {
  value: DateParts;
  todayYear: number;
  disabled: boolean;
  onChange: (part: keyof DateParts, value: number) => void;
}) {
  const { fontScale } = useWindowDimensions();
  const rowHeight = Math.max(34, Math.ceil(28 * fontScale));
  return (
    <View style={[styles.picker, { height: rowHeight * 5 + 10 }]}>
      <View
        pointerEvents="none"
        style={[styles.band, { height: rowHeight + 6, top: rowHeight * 2 + 2 }]}
      />
      <Column
        label="출생 연도"
        value={value.year}
        min={1}
        max={todayYear}
        unit=""
        rowHeight={rowHeight}
        disabled={disabled}
        onChange={(v) => onChange('year', v)}
      />
      <Column
        label="출생 월"
        value={value.month}
        min={1}
        max={12}
        unit="월"
        rowHeight={rowHeight}
        disabled={disabled}
        onChange={(v) => onChange('month', v)}
      />
      <Column
        label="출생 일"
        value={value.day}
        min={1}
        max={daysInMonth(value.year, value.month)}
        unit="일"
        rowHeight={rowHeight}
        disabled={disabled}
        onChange={(v) => onChange('day', v)}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  picker: {
    flexDirection: 'row',
    backgroundColor: '#2B3591',
    borderRadius: 4,
    paddingVertical: 5,
    boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
  },
  column: { flex: 1, minWidth: 0 },
  row: { justifyContent: 'center', alignItems: 'center' },
  value: {
    fontFamily: theme.font,
    color: theme.color.muted,
    textAlign: 'center',
  },
  selected: { color: theme.color.text, fontWeight: '700' },
  band: {
    position: 'absolute',
    left: 12,
    right: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#4A5BC2',
    backgroundColor: '#1E2063',
  },
});

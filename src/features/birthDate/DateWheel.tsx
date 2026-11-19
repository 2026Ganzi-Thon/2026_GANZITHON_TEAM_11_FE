import { useMemo } from 'react';
import { WheelColumn } from '../../ui/WheelColumn';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { daysInMonth, type DateParts } from './date';
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
  const years = useMemo(
    () => Array.from({ length: todayYear }, (_, i) => i + 1),
    [todayYear],
  );
  return (
    <View style={[styles.picker, { height: rowHeight * 5 + 10 }]}>
      <View
        pointerEvents="none"
        style={[styles.band, { height: rowHeight + 6, top: rowHeight * 2 + 2 }]}
      />
      <WheelColumn
        label="출생 연도"
        value={value.year}
        values={years}
        format={String}
        rowHeight={rowHeight}
        disabled={disabled}
        onChange={(v) => onChange('year', v)}
      />
      <WheelColumn
        label="출생 월"
        value={value.month}
        values={Array.from({ length: 12 }, (_, i) => i + 1)}
        format={(v) => `${v}월`}
        rowHeight={rowHeight}
        disabled={disabled}
        onChange={(v) => onChange('month', v)}
      />
      <WheelColumn
        label="출생 일"
        value={value.day}
        values={Array.from(
          { length: daysInMonth(value.year, value.month) },
          (_, i) => i + 1,
        )}
        format={(v) => `${v}일`}
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

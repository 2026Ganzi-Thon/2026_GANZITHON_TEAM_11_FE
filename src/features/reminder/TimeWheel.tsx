import { WheelColumn } from '../../ui/WheelColumn';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import type { TimeParts } from './time';
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
      <WheelColumn
        wrap
        label="알림 오전·오후"
        values={periods}
        value={value.period}
        format={(v) => (v ? '오후' : '오전')}
        rowHeight={rowHeight}
        disabled={disabled}
        onChange={(v) => onChange('period', v)}
      />
      <WheelColumn
        wrap
        label="알림 시"
        values={hours}
        value={value.hour}
        format={String}
        rowHeight={rowHeight}
        disabled={disabled}
        onChange={(v) => onChange('hour', v)}
      />
      <WheelColumn
        wrap
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

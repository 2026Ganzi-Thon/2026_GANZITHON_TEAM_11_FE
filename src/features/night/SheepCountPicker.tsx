import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../ui/theme';
import { changeSheepCount } from './entry';

export function SheepCountPicker({
  value,
  disabled,
  onChange,
}: {
  value: number;
  disabled: boolean;
  onChange: (count: number) => void;
}) {
  return (
    <View>
      <View style={styles.flock} pointerEvents="none" accessible={false}>
        <Image
          source={require('../../../assets/images/night-entry/sheep-large.svg')}
          style={styles.large}
          contentFit="contain"
        />
        <Image
          source={require('../../../assets/images/night-entry/sheep.svg')}
          style={styles.sheep}
          contentFit="contain"
        />
        <Image
          source={require('../../../assets/images/night-entry/sheep-shadow.svg')}
          style={styles.sheep}
          contentFit="contain"
        />
        <Image
          source={require('../../../assets/images/night-entry/sheep.svg')}
          style={styles.sheep}
          contentFit="contain"
        />
        <Image
          source={require('../../../assets/images/night-entry/sheep.svg')}
          style={styles.sheep}
          contentFit="contain"
        />
      </View>
      <View style={styles.stepper}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="한 마리 줄이기"
          accessibilityState={{ disabled: disabled || value <= 3 }}
          disabled={disabled || value <= 3}
          onPress={() => onChange(changeSheepCount(value, -1))}
          style={[styles.step, (disabled || value <= 3) && styles.disabled]}
        >
          <Text style={styles.sign}>−</Text>
        </Pressable>
        <Text
          accessibilityLabel="선택한 양 수"
          accessibilityLiveRegion="polite"
          style={styles.count}
        >
          {value}마리
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="한 마리 늘리기"
          accessibilityState={{ disabled: disabled || value >= 30 }}
          disabled={disabled || value >= 30}
          onPress={() => onChange(changeSheepCount(value, 1))}
          style={[styles.step, (disabled || value >= 30) && styles.disabled]}
        >
          <Text style={styles.sign}>+</Text>
        </Pressable>
      </View>
      <View style={styles.presets}>
        {[3, 10, 20, 30].map((count) => (
          <Pressable
            key={count}
            accessibilityRole="radio"
            accessibilityLabel={`${count}마리`}
            accessibilityState={{
              selected: value === count,
              checked: value === count,
              disabled,
            }}
            disabled={disabled}
            onPress={() => onChange(count)}
            style={[styles.preset, value === count && styles.selected]}
          >
            <Text style={styles.presetLabel}>{count}마리</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.help}>3마리부터 30마리까지 고를 수 있어요</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  flock: {
    height: 150,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  large: { flex: 1.3, height: 65 },
  sheep: { flex: 1, height: 50, marginTop: 15 },
  stepper: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    paddingVertical: 12,
  },
  step: {
    width: 48,
    height: 48,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#4A5BC2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sign: {
    fontFamily: theme.font,
    color: theme.color.text,
    fontSize: 22,
    lineHeight: 30,
    includeFontPadding: false,
  },
  count: {
    fontFamily: theme.font,
    color: theme.color.text,
    fontSize: 30,
    lineHeight: 42,
    includeFontPadding: false,
    fontWeight: '700',
    minWidth: 112,
    textAlign: 'center',
  },
  disabled: { opacity: 0.4 },
  presets: { flexDirection: 'row', gap: 8, marginTop: 14 },
  preset: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#4A5BC2',
    backgroundColor: '#1E2063',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  selected: { backgroundColor: '#3C47AD', borderColor: theme.color.primary },
  presetLabel: {
    fontFamily: theme.font,
    fontSize: 13,
    lineHeight: 20,
    includeFontPadding: false,
    color: theme.color.text,
  },
  help: {
    fontFamily: theme.font,
    fontSize: 12,
    lineHeight: 18,
    color: theme.color.muted,
    textAlign: 'center',
    marginTop: 10,
  },
});

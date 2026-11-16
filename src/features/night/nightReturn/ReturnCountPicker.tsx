import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../../ui/theme';
export type RestartCount = 3 | 5 | 10;
export function ReturnCountPicker({
  value,
  disabled,
  onChange,
}: {
  value: RestartCount;
  disabled: boolean;
  onChange: (count: RestartCount) => void;
}) {
  return (
    <View style={styles.content}>
      <Text style={styles.title}>짧게 다시 세기</Text>
      <View style={styles.row} accessibilityRole="radiogroup">
        {([3, 5, 10] as const).map((count) => (
          <Pressable
            key={count}
            accessibilityRole="radio"
            accessibilityLabel={`${count}마리`}
            accessibilityState={{
              checked: value === count,
              selected: value === count,
              disabled,
            }}
            disabled={disabled}
            onPress={() => onChange(count)}
            style={styles.touch}
          >
            <View style={styles.chip}>
              {value === count && (
                <Image
                  source={require('../../../../assets/images/night-return/chip-glow.svg')}
                  style={styles.glow}
                  contentFit="fill"
                  accessible={false}
                />
              )}
              <Image
                source={
                  value === count
                    ? require('../../../../assets/images/night-return/chip-selected-border.svg')
                    : require('../../../../assets/images/night-return/chip-border.svg')
                }
                style={StyleSheet.absoluteFill}
                contentFit="fill"
                accessible={false}
              />
              <Image
                source={
                  value === count
                    ? require('../../../../assets/images/night-return/chip-selected-fill.svg')
                    : require('../../../../assets/images/night-return/chip-fill.svg')
                }
                style={styles.fill}
                contentFit="fill"
                accessible={false}
              />
              <Text style={[styles.label, value === count && styles.selected]}>
                {count}마리
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  content: { gap: 10 },
  title: {
    fontFamily: theme.font,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
    color: theme.color.text,
  },
  row: { flexDirection: 'row', gap: 6 },
  touch: { flex: 1, minHeight: 48, justifyContent: 'center' },
  chip: {
    minHeight: 40,
    paddingHorizontal: 4,
    paddingVertical: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glow: { position: 'absolute', top: -3, left: -3, right: -3, bottom: -3 },
  fill: { position: 'absolute', top: 2, left: 2, right: 2, bottom: 2 },
  label: {
    fontFamily: theme.font,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: theme.color.muted,
  },
  selected: { color: theme.color.text, fontWeight: '700' },
});

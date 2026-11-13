import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text } from 'react-native';
import { theme } from '../../ui/theme';
import type { FluffState } from './types';
export interface FluffControlProps {
  state: FluffState;
  onToggle: () => void;
}
export function FluffControl({
  state,
  onToggle,
  warm,
  expanded,
}: { warm: boolean; expanded: boolean } & FluffControlProps) {
  const target = state.pending ? state.target : state.saved,
    disabled = state.error === 'closed';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={target ? '솜털 떼기' : '솜털 붙이기'}
      accessibilityHint="붙인 카드는 다음 아침 데려오기 후보 위쪽에 보여요."
      accessibilityState={{
        selected: state.saved,
        busy: state.pending,
        disabled,
      }}
      disabled={disabled}
      onPress={onToggle}
      style={[styles.button, expanded && styles.expanded]}
    >
      <Image
        source={require('../../../assets/images/fluff/default.svg')}
        accessible={false}
        contentFit="fill"
        style={styles.icon}
      />
      <Text style={[styles.label, warm && styles.pale]}>
        {disabled
          ? '변경 마감'
          : state.pending
            ? state.target
              ? '붙이는 중'
              : '떼는 중'
            : state.saved
              ? '솜털 붙임'
              : '솜털 붙이기'}
      </Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: { width: 70, minHeight: 58, alignItems: 'center' },
  expanded: { width: 132 },
  icon: { width: 44, height: 44 },
  label: {
    fontFamily: theme.font,
    color: '#4A5290',
    fontSize: 10,
    lineHeight: 14,
    includeFontPadding: false,
    textAlign: 'center',
  },
  pale: { color: theme.color.muted },
});

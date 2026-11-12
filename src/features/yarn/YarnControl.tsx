import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../ui/theme';
import type { YarnState } from './types';
export interface YarnControlProps {
  state: YarnState;
  onToggle: () => void;
}
export function YarnControl({
  state,
  onToggle,
  warm,
  expanded,
}: { warm: boolean; expanded: boolean } & YarnControlProps) {
  const target = state.pending ? state.target : state.sent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={target ? '털실 보내기 취소' : '털실 보내기'}
      accessibilityState={{ selected: state.sent, busy: state.pending }}
      accessibilityHint={
        state.pending
          ? '다시 누르면 마지막 선택으로 변경해요. 다른 양을 보는 동안에도 처리를 계속해요.'
          : undefined
      }
      onPress={onToggle}
      style={[styles.button, expanded && styles.expanded]}
    >
      <View style={styles.slot}>
        <Image
          accessible={false}
          source={
            state.sent
              ? require('../../../assets/images/yarn/sent.svg')
              : require('../../../assets/images/yarn/default.svg')
          }
          contentFit="fill"
          style={state.sent ? styles.sent : styles.icon}
        />
      </View>
      <Text
        style={[
          styles.label,
          warm && styles.pale,
          state.sent && !warm && styles.selected,
        ]}
      >
        {state.pending
          ? state.target
            ? '보내는 중'
            : '거두는 중'
          : state.sent
            ? '털실 보냄'
            : '털실 보내기'}
      </Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: { width: 70, minHeight: 58, alignItems: 'center' },
  expanded: { width: 132 },
  slot: { width: 44, height: 44 },
  icon: { width: 44, height: 44 },
  sent: { position: 'absolute', left: -6, top: -6, width: 56, height: 56 },
  label: {
    fontFamily: theme.font,
    color: '#4A5290',
    fontSize: 10,
    lineHeight: 14,
    includeFontPadding: false,
    textAlign: 'center',
  },
  selected: { color: '#B98A2E' },
  pale: { color: theme.color.muted },
});

import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Modal,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { NightScreen } from '../../../ui/NightScreen';
import { Notice } from '../../../ui/Notice';
import { Button } from '../../../ui/Button';
import type { NightExpiryActions } from './types';
import { useNightExpiry } from './useNightExpiry';
interface Props {
  actions?: NightExpiryActions;
  children: (blocked: boolean) => ReactNode;
  onMorning: () => void;
  onHome: () => void;
}
export function NightExpiryBoundary(props: Props) {
  const [source, setSource] = useState({ actions: props.actions, version: 0 });
  if (source.actions !== props.actions)
    setSource({ actions: props.actions, version: source.version + 1 });
  if (!props.actions) return props.children(false);
  return <Session key={source.version} {...props} actions={props.actions} />;
}
function Session({
  actions,
  children,
  onMorning,
  onHome,
}: Props & { actions: NightExpiryActions }) {
  const state = useNightExpiry(actions),
    blocked = state.phase !== 'open' || !state.foreground;
  useEffect(() => {
    if (state.phase !== 'expired') return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      onMorning();
      return true;
    });
    return () => listener.remove();
  }, [state.phase, onMorning]);
  const status = (
    <NightScreen>
      <ScrollView contentContainerStyle={styles.content}>
        {state.phase === 'expired' ? (
          <>
            <Notice
              title="밤이 끝났어요"
              description="저장이 확인된 기록을 아침에 이어서 볼 수 있어요."
            />
            <Button label="아침으로 가기" onPress={onMorning} />
          </>
        ) : state.phase === 'error' ? (
          <>
            <Notice
              error
              title="밤 시간을 확인하지 못했어요"
              description="기록을 유지한 채 진행을 잠시 멈췄어요. 마감 상태를 다시 확인해 주세요."
            />
            <Button label="다시 확인" onPress={state.retry} />
            <Button label="홈으로 돌아가기" onPress={onHome} />
          </>
        ) : (
          <>
            <ActivityIndicator
              accessibilityLabel="밤 시간 확인 중"
              color="#CBD0FF"
            />
            <Notice
              title="밤 시간을 확인하고 있어요"
              description="확인이 끝날 때까지 잠시 기다려 주세요."
            />
            <Button label="홈으로 돌아가기" onPress={onHome} />
          </>
        )}
      </ScrollView>
    </NightScreen>
  );
  if (state.phase === 'expired' || !state.opened) return status;
  return (
    <View style={styles.fill}>
      <View
        style={styles.fill}
        pointerEvents={blocked ? 'none' : 'auto'}
        accessibilityElementsHidden={blocked}
        importantForAccessibility={blocked ? 'no-hide-descendants' : 'auto'}
      >
        {children(blocked)}
      </View>
      <Modal
        visible={blocked && state.foreground}
        animationType="none"
        onRequestClose={onHome}
      >
        {status}
      </Modal>
    </View>
  );
}
const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: 20, gap: 20, flexGrow: 1, justifyContent: 'center' },
});

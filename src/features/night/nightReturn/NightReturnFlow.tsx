import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { NightScreen } from '../../../ui/NightScreen';
import { Button } from '../../../ui/Button';
import { Notice } from '../../../ui/Notice';
import { theme } from '../../../ui/theme';
import type { NightReturnActions, ReturnRoute } from './model';
import type { RestartCount } from './ReturnCountPicker';
import { NightReturnScreen } from './NightReturnScreen';
import { useNightReturn, type ReturnOutcome } from './useNightReturn';
export interface RestartRequest {
  nightId: string;
  count: RestartCount;
}
interface Props {
  actions: NightReturnActions;
  onRestart: (request: RestartRequest) => void;
  onNavigate: (route: Exclude<ReturnRoute, { kind: 'return' }>) => void;
  onExit: () => void;
}
export function NightReturnFlow(props: Props) {
  const [source, setSource] = useState({ actions: props.actions, version: 0 });
  if (source.actions !== props.actions)
    setSource({ actions: props.actions, version: source.version + 1 });
  return <Session key={source.version} {...props} />;
}
function Session({ actions, onRestart, onNavigate, onExit }: Props) {
  const { state, restart, retry, exit } = useNightReturn(actions);
  const dispatched = useRef<ReturnOutcome | null>(null);
  const rest = useCallback(() => {
    if (exit()) onExit();
  }, [exit, onExit]);
  useEffect(() => {
    const next = state.outcome;
    if (!next || dispatched.current === next) return;
    dispatched.current = next;
    if (next.kind === 'restart')
      onRestart({ nightId: next.nightId, count: next.count });
    else onNavigate(next);
  }, [state.outcome, onRestart, onNavigate]);
  useEffect(() => {
    if (state.record && state.phase !== 'handoff') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      rest();
      return true;
    });
    return () => sub.remove();
  }, [rest, state.record, state.phase]);
  if (state.record && state.phase !== 'handoff')
    return (
      <NightReturnScreen
        record={state.record}
        onRestart={restart}
        onRest={rest}
        pending={state.phase === 'loading'}
        error={state.phase === 'error'}
        onRetry={retry}
      />
    );
  return (
    <NightScreen>
      <ScrollView contentContainerStyle={styles.content}>
        {state.phase === 'error' ? (
          <>
            <Notice
              error
              title="밤 기록을 불러오지 못했어요"
              description="기록을 확인한 뒤에만 다시 세기를 준비할 수 있어요."
            />
            <Button label="다시 불러오기" onPress={retry} />
          </>
        ) : (
          <>
            <ActivityIndicator color={theme.color.text} />
            <Text style={styles.message}>오늘 밤 상태를 확인하고 있어요</Text>
          </>
        )}
        <Button label="나가기" onPress={rest} />
      </ScrollView>
    </NightScreen>
  );
}
const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', padding: 20, gap: 20 },
  message: {
    fontFamily: theme.font,
    fontSize: 16,
    lineHeight: 24,
    color: theme.color.text,
    textAlign: 'center',
  },
});

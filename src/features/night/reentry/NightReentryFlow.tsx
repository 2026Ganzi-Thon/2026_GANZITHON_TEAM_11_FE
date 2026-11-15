import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentRef,
} from 'react';
import {
  ActivityIndicator,
  BackHandler,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button } from '../../../ui/Button';
import { NightScreen } from '../../../ui/NightScreen';
import { Notice } from '../../../ui/Notice';
import { theme } from '../../../ui/theme';
import { SupportContent } from '../../support/SupportContent';
import type { ReentryActions } from './model';
import { ReentryEntry } from './ReentryEntry';
import { ReentryFeed } from './ReentryFeed';
import { useNightReentry } from './useNightReentry';

export function NightReentryFlow(props: {
  actions: ReentryActions;
  onExit: () => void;
}) {
  const [source, setSource] = useState({ actions: props.actions, version: 0 });
  if (source.actions !== props.actions)
    setSource({ actions: props.actions, version: source.version + 1 });
  return <ReentrySessionFlow key={source.version} {...props} />;
}
function ReentrySessionFlow({
  actions,
  onExit,
}: {
  actions: ReentryActions;
  onExit: () => void;
}) {
  const flow = useNightReentry(actions),
    state = flow.state;
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const revealFrame = useRef<number | null>(null);
  const supportError = state.kind === 'support' ? state.error : null;
  const revealError = useCallback(() => {
    if (!supportError) return;
    if (revealFrame.current !== null) cancelAnimationFrame(revealFrame.current);
    revealFrame.current = requestAnimationFrame(() => {
      revealFrame.current = null;
      scroll.current?.scrollToEnd({ animated: false });
    });
  }, [supportError]);
  useEffect(
    () => () => {
      if (revealFrame.current !== null)
        cancelAnimationFrame(revealFrame.current);
      revealFrame.current = null;
    },
    [supportError],
  );
  const back = state.kind === 'paused' ? onExit : flow.pause;
  useEffect(() => {
    if (state.kind === 'entry' || state.kind === 'feed') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      back();
      return true;
    });
    return () => sub.remove();
  }, [back, state.kind]);
  if (state.kind === 'entry')
    return (
      <ReentryEntry
        key={state.route.next_screen}
        actions={actions}
        route={state.route}
        onBack={flow.pause}
        onCreated={flow.showFeed}
        onRecorded={flow.recorded}
      />
    );
  if (state.kind === 'feed')
    return (
      <ReentryFeed
        key={`${state.session.id}:${state.session.writer_epoch}`}
        actions={actions}
        session={state.session}
        onBack={flow.pause}
        onPosition={flow.observe}
      />
    );
  return (
    <NightScreen
      background={
        state.kind === 'support'
          ? require('../../../../assets/images/night-support/background.svg')
          : undefined
      }
    >
      <View style={styles.topbar}>
        <Text style={styles.title}>
          {state.kind === 'support' ? '도움 안내' : '오늘 밤 이어 보기'}
        </Text>
        <Button label="재진입 나가기" onPress={back} />
      </View>
      <ScrollView ref={scroll} contentContainerStyle={styles.content}>
        {state.kind === 'support' ? (
          <SupportContent
            context="night"
            support={state.route.support}
            pending={state.pending}
            error={state.error}
            onErrorLayout={revealError}
            onContinue={() => void flow.continueSupport()}
            onReload={flow.reloadSupport}
          />
        ) : state.kind === 'loading' ? (
          <View style={styles.waiting}>
            <ActivityIndicator color={theme.color.text} />
            <Text style={styles.message} accessibilityLiveRegion="polite">
              {state.job.kind === 'resume'
                ? '이어서 셀 양을 확인하고 있어요'
                : '오늘 밤 상태를 확인하고 있어요'}
            </Text>
          </View>
        ) : state.kind === 'error' ? (
          <>
            <Notice
              error
              title={
                state.unsupported
                  ? '지금은 이 밤을 이어 볼 수 없어요'
                  : state.closed
                    ? '이 세션은 이미 끝났어요'
                    : '밤 상태를 확인하지 못했어요'
              }
              description={
                state.unsupported
                  ? '낮 화면과 마무리 복귀는 이번 미리보기 범위에 포함하지 않았어요.'
                  : state.closed
                    ? '밤 상태를 다시 확인해 주세요.'
                    : '현재 위치를 확인한 뒤에만 이어 볼 수 있어요. 다시 시도해 주세요.'
              }
            />
            <Button
              label={
                state.unsupported
                  ? '시연 끝내기'
                  : state.closed
                    ? '밤 상태 다시 확인'
                    : '다시 시도'
              }
              onPress={state.unsupported ? onExit : flow.retry}
            />
          </>
        ) : (
          <>
            <Notice
              title="오늘 밤 보기를 잠깐 멈췄어요"
              description={
                state.position
                  ? `${state.position.position}번째 양에서 멈췄어요. 본 양은 최대 ${state.position.furthestPosition}마리예요. 밤 상태를 확인해 이어 볼 수 있어요.`
                  : '밤 상태를 다시 확인해 이어 볼 수 있어요.'
              }
            />
            <Button label="밤 상태 다시 확인" onPress={flow.refresh} />
            <Button label="시연 끝내기" onPress={onExit} />
          </>
        )}
      </ScrollView>
    </NightScreen>
  );
}
const styles = StyleSheet.create({
  topbar: { padding: 20, gap: 12 },
  title: {
    fontFamily: theme.font,
    color: theme.color.text,
    fontSize: 20,
    lineHeight: 30,
    fontWeight: '700',
  },
  content: { padding: 20, paddingBottom: 40, gap: 20, flexGrow: 1 },
  waiting: { gap: 20, alignItems: 'center' },
  message: {
    fontFamily: theme.font,
    color: theme.color.text,
    fontSize: 16,
    lineHeight: 26,
  },
});

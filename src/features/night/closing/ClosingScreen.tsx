import { useEffect } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button } from '../../../ui/Button';
import { NightScreen } from '../../../ui/NightScreen';
import { Notice } from '../../../ui/Notice';
import { theme } from '../../../ui/theme';
import { FeedCard } from '../feed/FeedCard';
import { ClosingArtwork } from './ClosingArtwork';
import type { ClosingActions, ClosingRequest } from './types';
import { useClosingFlow } from './useClosingFlow';
export function ClosingScreen({
  input,
  actions,
  onExit,
}: {
  input: ClosingRequest;
  actions: ClosingActions;
  onExit: () => void;
}) {
  const flow = useClosingFlow(input, actions, onExit);
  const { state, request, exit } = flow;
  const summary = state.result?.summary;
  const card = state.result?.closing_card;
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        exit();
        return true;
      },
    );
    return () => subscription.remove();
  }, [exit]);
  const content =
    state.step === 'pending' ? (
      <View style={styles.center}>
        <ActivityIndicator color={theme.color.primary} />
        <Text style={styles.description} accessibilityLiveRegion="polite">
          {state.job.kind === 'finish'
            ? '마무리를 준비하고 있어요'
            : '선택을 확인하고 있어요'}
        </Text>
      </View>
    ) : state.step === 'error' ? (
      <View style={styles.center}>
        <Notice
          error
          title={
            state.job.kind === 'finish'
              ? '마무리를 준비하지 못했어요'
              : '선택을 확인하지 못했어요'
          }
          description="잠시 후 다시 시도해 주세요. 예시 응답으로 확인 중이에요."
        />
        <Button label="다시 시도" onPress={flow.retry} />
      </View>
    ) : state.step === 'card' ? (
      <>
        <ScrollView contentContainerStyle={styles.cardContent}>
          {card?.available && card.content ? (
            <FeedCard card={card} isLast={false} />
          ) : (
            <Notice
              title="지금은 마무리 카드를 볼 수 없어요"
              description="카드를 기록하지 않고 마무리로 넘어가요."
            />
          )}
        </ScrollView>
        <View style={styles.footer}>
          <Button label="다음" onPress={flow.next} />
        </View>
      </>
    ) : state.step === 'summary' || state.step === 'offer' ? (
      <>
        <ScrollView contentContainerStyle={styles.content}>
          <ClosingArtwork offer={state.step === 'offer'} />
          <Text style={styles.title} accessibilityRole="header">
            {state.step === 'offer'
              ? '누군가에게\n한마디 남겨 볼래요?'
              : request.reason === 'completed'
                ? `${summary?.counted}마리 다 셌어요`
                : `오늘은 ${summary?.counted}마리까지 셌어요`}
          </Text>
          {state.step === 'summary' && (
            <Text style={styles.description}>
              오늘 밤 맡긴 걱정 {summary?.entrusted_count}개 · 솜털{' '}
              {summary?.fluff_count}개
            </Text>
          )}
        </ScrollView>
        <View style={styles.footer}>
          {state.step === 'summary' ? (
            <Button label="다음" onPress={flow.next} />
          ) : (
            <>
              <Button label="지금 쓸래요" onPress={() => flow.choose('now')} />
              <Secondary
                label="아침에 쓸게요"
                onPress={() => flow.choose('morning')}
              />
            </>
          )}
        </View>
      </>
    ) : (
      <View style={styles.center}>
        <Notice
          title={
            state.step === 'writing'
              ? '카드 작성 화면은 준비 중이에요'
              : '편안한 밤 보내요'
          }
          description={
            state.step === 'writing'
              ? '지금 쓰기 선택까지만 확인했어요. 실제 카드는 작성되거나 저장되지 않았어요.'
              : '마무리 미리보기를 마쳤어요. 실제 종료 기록과 아침 작성 예약은 저장하지 않았어요.'
          }
        />
        {state.step === 'writing' && (
          <Button
            label="아침에 쓸게요"
            onPress={() => flow.choose('morning')}
          />
        )}
        <Button label="미리보기로 돌아가기" onPress={flow.exit} />
      </View>
    );
  return (
    <NightScreen
      background={
        state.step === 'offer'
          ? require('../../../../assets/images/closing/offer-sky.svg')
          : require('../../../../assets/images/closing/summary-sky.svg')
      }
    >
      <View style={styles.header}>
        <Text style={styles.preview}>미리보기 · 저장 안 함</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="미리보기 나가기"
          onPress={flow.exit}
          style={styles.exit}
        >
          <Text style={styles.exitLabel}>미리보기 나가기</Text>
        </Pressable>
      </View>
      {content}
    </NightScreen>
  );
}
function Secondary({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.secondary}
    >
      <Text style={styles.secondaryLabel}>{label}</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  header: {
    minHeight: 48,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  preview: {
    fontFamily: theme.font,
    fontSize: 10,
    lineHeight: 16,
    color: theme.color.muted,
  },
  exit: { minHeight: 48, justifyContent: 'center', paddingLeft: 12 },
  exitLabel: {
    fontFamily: theme.font,
    fontSize: 12,
    lineHeight: 18,
    color: theme.color.muted,
  },
  content: { paddingHorizontal: 20, paddingBottom: 20, gap: 14, flexGrow: 1 },
  cardContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  center: { flex: 1, justifyContent: 'center', padding: 20, gap: 20 },
  title: {
    fontFamily: theme.font,
    fontSize: 22,
    lineHeight: 31,
    fontWeight: '700',
    color: theme.color.text,
    textAlign: 'center',
  },
  description: {
    fontFamily: theme.font,
    fontSize: 14,
    lineHeight: 21,
    color: theme.color.muted,
    textAlign: 'center',
  },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, gap: 14 },
  secondary: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#4A5BC2',
    borderRadius: 4,
    backgroundColor: '#1E2063',
  },
  secondaryLabel: {
    fontFamily: theme.font,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    color: theme.color.text,
    textAlign: 'center',
  },
});

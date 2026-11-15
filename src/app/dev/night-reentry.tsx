import { useMemo, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { NightReentryFlow } from '../../features/night/reentry/NightReentryFlow';
import {
  createMockNightReentry,
  type ReentryScenario,
} from '../../mocks/nightReentry';
import { Button } from '../../ui/Button';
import { NightScreen } from '../../ui/NightScreen';
import { Notice } from '../../ui/Notice';
import { theme } from '../../ui/theme';
const scenarios: readonly [ReentryScenario, string][] = [
  ['active', '기존 세션 · 2번째 양'],
  ['untouched', '아직 보지 않은 세션'],
  ['recorded', '기록된 고민 · 양 수 선택'],
  ['new', '새 고민 · 세션 생성'],
  ['support-active', '도움 안내 → 기존 세션'],
  ['support-count', '도움 안내 → 양 수 선택'],
  ['support-missing', '도움 정보 누락·재조회'],
  ['continue-retry', '계속하기 실패·재시도'],
  ['resume-retry', '세션 재개 실패·재시도'],
  ['resume-lost-response', '재개 응답 유실·재시도'],
  ['slow-continue', '느린 계속하기·취소'],
  ['slow-resume', '느린 세션 재개·취소'],
  ['closed-session', '종료된 세션 · 상태 재조회'],
  ['feed-retry', '피드 조회 실패·재시도'],
  ['bootstrap-retry', '밤 상태 조회 실패·재시도'],
  ['long-support', '긴 도움 안내'],
];
export default function NightReentryPreview() {
  const [scenario, setScenario] = useState<ReentryScenario | null>(null);
  const actions = useMemo(
    () => (scenario ? createMockNightReentry(scenario) : null),
    [scenario],
  );
  if (!__DEV__) return <Redirect href="/" />;
  if (actions)
    return (
      <NightReentryFlow actions={actions} onExit={() => setScenario(null)} />
    );
  return (
    <NightScreen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          밤 재진입 미리보기
        </Text>
        <Notice
          title="가상의 밤 상태로 확인해 주세요"
          description="버튼을 눌러 재진입을 시연해요. 기록은 이 시연 안에서만 유지하며 종료하면 사라져요. 실제 서버·앱 종료 후 복원·오프라인 저장은 연결하지 않았어요. 도움 안내는 입력과 무관한 예시이며 기기 앱 열기는 실제로 동작해요."
        />
        {scenarios.map(([id, label]) => (
          <Button key={id} label={label} onPress={() => setScenario(id)} />
        ))}
        <Button
          label="시작 화면으로"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace('/')
          }
        />
      </ScrollView>
    </NightScreen>
  );
}
const styles = StyleSheet.create({
  content: { padding: theme.gutter, gap: 16 },
  title: {
    fontFamily: theme.font,
    color: theme.color.text,
    fontSize: 24,
    lineHeight: 34,
    fontWeight: '700',
  },
});

import { useMemo, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { FeedScreen } from '../../features/night/feed/FeedScreen';
import { createMockNightFeed, type FeedScenario } from '../../mocks/nightFeed';
import { Button } from '../../ui/Button';
import { NightScreen } from '../../ui/NightScreen';
import { Notice } from '../../ui/Notice';
import { theme } from '../../ui/theme';
const scenarios: readonly { label: string; value: FeedScenario }[] = [
  { label: '카드 유형 6개', value: 'success' },
  { label: '불러오기 실패 후 재시도', value: 'retry' },
  { label: '긴 글 카드', value: 'long' },
  { label: '볼 수 없는 카드', value: 'unavailable' },
  { label: '빈 피드', value: 'empty' },
];
export default function NightFeedPreview() {
  const [scenario, setScenario] = useState<FeedScenario | null>(null);
  const load = useMemo(
    () => (scenario ? createMockNightFeed(6, scenario) : null),
    [scenario],
  );
  if (!__DEV__) return <Redirect href="/" />;
  if (load) return <FeedScreen load={load} onBack={() => setScenario(null)} />;
  return (
    <NightScreen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          피드 화면 미리보기
        </Text>
        <Notice
          title="예시 카드로 화면만 확인해요"
          description="실제 서버·진행 저장·음악 재생은 연결하지 않습니다. 솜털·털실·곡 담기와 쉼표양은 후속 범위이며, 이 미리보기의 배치는 실제 피드 생성 규칙과 다릅니다."
        />
        {scenarios.map((scenario) => (
          <Button
            key={scenario.value}
            label={scenario.label}
            onPress={() => setScenario(scenario.value)}
          />
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
  content: { flexGrow: 1, justifyContent: 'center', padding: 20, gap: 14 },
  title: {
    fontFamily: theme.font,
    fontSize: 24,
    lineHeight: 34,
    fontWeight: '700',
    color: theme.color.text,
  },
});

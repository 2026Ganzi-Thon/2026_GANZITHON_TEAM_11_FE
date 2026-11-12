import { useMemo, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { FeedScreen } from '../../features/night/feed/FeedScreen';
import {
  createMockNightClosing,
  type ClosingScenario,
} from '../../mocks/nightClosing';
import { createMockNightFeed } from '../../mocks/nightFeed';
import { Button } from '../../ui/Button';
import { NightScreen } from '../../ui/NightScreen';
import { Notice } from '../../ui/Notice';
import { theme } from '../../ui/theme';
const scenarios: readonly { label: string; value: ClosingScenario }[] = [
  { label: '완료·중도 종료', value: 'success' },
  { label: '종료 응답 유실 후 재시도', value: 'finish-lost' },
  { label: '마무리 카드 확인 실패', value: 'view-retry' },
  { label: '작성 선택 실패', value: 'choice-retry' },
  { label: '볼 수 없는 마무리 카드', value: 'unavailable' },
  { label: '이미 작성한 밤', value: 'offered-before' },
];
export default function NightClosingPreview() {
  const [scenario, setScenario] = useState<ClosingScenario | null>(null);
  const preview = useMemo(
    () =>
      scenario
        ? {
            load: createMockNightFeed(3),
            actions: createMockNightClosing(scenario),
          }
        : null,
    [scenario],
  );
  if (!__DEV__) return <Redirect href="/" />;
  if (preview)
    return (
      <FeedScreen
        load={preview.load}
        closingActions={preview.actions}
        onBack={() => setScenario(null)}
      />
    );
  return (
    <NightScreen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title} accessibilityRole="header">
          밤 마무리 미리보기
        </Text>
        <Notice
          title="3마리로 마무리를 확인해요"
          description="끝까지 센 뒤 마무리하거나, 그만 세고 싶어요를 눌러 중도 종료해 보세요. 실제 저장·카드 작성·아침 예약은 하지 않아요. 휴대폰 뒤로가기는 종료 없이 미리보기를 닫아요."
        />
        {scenarios.map(({ label, value }) => (
          <Button
            key={value}
            label={label}
            onPress={() => setScenario(value)}
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

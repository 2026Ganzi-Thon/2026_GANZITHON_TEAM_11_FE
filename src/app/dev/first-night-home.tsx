import { useMemo, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { HomeFlow } from '../../features/home/HomeFlow';
import { NightEntryScreen } from '../../features/night/NightEntryScreen';
import { createMockHome, type HomeScenario } from '../../mocks/firstNightHome';
import { createMockNightEntry } from '../../mocks/nightEntry';
import { createMockNightFeed } from '../../mocks/nightFeed';
import { createMockNightClosing } from '../../mocks/nightClosing';
import { NightScreen } from '../../ui/NightScreen';
import { Button } from '../../ui/Button';
import { Notice } from '../../ui/Notice';
import { theme } from '../../ui/theme';
const scenarios: readonly [HomeScenario, string][] = [
  ['day', '첫 밤 전 · 낮'],
  ['night', '첫 밤 전 · 밤'],
  ['before-night', '21시 경계 · 8초 전'],
  ['before-day', '04시 경계 · 8초 전'],
  ['load-retry', '홈 조회 실패·재시도'],
  ['refresh-retry', '밤 진입 확인 실패·재시도'],
  ['slow', '느린 시간 확인'],
  ['fortune-retry', '운세 실패·재시도'],
  ['adopted', '첫 밤 이후 · 일반 홈'],
  ['empty-flock', '센 밤이 있는 빈 양떼'],
  ['candidates', '미채택 후보 → 일반 홈'],
  ['banner', '일반 홈 · 받은 털실'],
];
export default function HomePreview() {
  const [scenario, setScenario] = useState<HomeScenario | null>(null),
    [night, setNight] = useState(false);
  const source = useMemo(
    () => (scenario ? createMockHome(scenario) : null),
    [scenario],
  );
  const nightSources = useMemo(
    () =>
      scenario
        ? {
            entry: createMockNightEntry('success'),
            closing: createMockNightClosing(),
          }
        : null,
    [scenario],
  );
  if (!__DEV__) return <Redirect href="/" />;
  if (source)
    return night && nightSources ? (
      <NightEntryScreen
        actions={nightSources.entry}
        onBack={() => setNight(false)}
        createFeed={createMockNightFeed}
        closingActions={nightSources.closing}
      />
    ) : (
      <HomeFlow
        source={source}
        onNight={() => setNight(true)}
        onExit={() => {
          setNight(false);
          setScenario(null);
        }}
      />
    );
  return (
    <NightScreen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          첫 밤 전 홈·시간 버튼
        </Text>
        <Notice
          title="홈 상태·시간은 예시입니다"
          description="센 밤 수와 서버 시각은 메모리 mock이에요. 경계 시나리오는 선택한 순간부터 시간이 흐릅니다. 운세는 생일에 따른 고정 예시이며 밤 입력은 독립 시연으로 열려요. 첫 밤 완료 후의 계정 갱신·기존 밤 복귀·영속 저장은 연결하지 않았어요."
        />
        {scenarios.map(([value, label]) => (
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
  content: { padding: 20, gap: 16, flexGrow: 1 },
  title: {
    fontFamily: theme.font,
    color: theme.color.text,
    fontSize: 24,
    lineHeight: 34,
    fontWeight: '700',
  },
});

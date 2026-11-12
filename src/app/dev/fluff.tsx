import { useMemo, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { FeedScreen } from '../../features/night/feed/FeedScreen';
import { NightMorningFlow } from '../../features/demo/NightMorningFlow';
import { createNightMorningDemo } from '../../mocks/nightMorningDemo';
import { createFluffPreview, type FluffScenario } from '../../mocks/fluff';
import { Button } from '../../ui/Button';
import { NightScreen } from '../../ui/NightScreen';
import { Notice } from '../../ui/Notice';
type Scenario = FluffScenario | 'long' | 'flow' | 'slow-flow';
const scenarios: readonly [Scenario, string][] = [
  ['flow', '밤부터 아침 후보 시연'],
  ['slow-flow', '밤 시연 · 솜털 5초 지연'],
  ['success', '솜털 붙이기·해제'],
  ['slow', '솜털 5초 지연·이동·연타'],
  ['retry', '솜털 붙이기 실패·재시도'],
  ['remove-retry', '솜털 떼기 실패·재시도'],
  ['lost-response', '솜털 응답 유실·최종 선택 재시도'],
  ['offline', '솜털 오프라인 예시'],
  ['unavailable', '솜털 삭제된 카드 응답'],
  ['closed', '솜털 밤 마감 응답'],
  ['long', '긴 글과 솜털 표시'],
];
export default function FluffPreview() {
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const demo = useMemo(
    () =>
      scenario === 'flow' || scenario === 'slow-flow'
        ? createNightMorningDemo(
            scenario === 'slow-flow' ? 'slow-fluff' : 'success',
          )
        : null,
    [scenario],
  );
  const preview = useMemo(
    () =>
      scenario && scenario !== 'flow' && scenario !== 'slow-flow'
        ? createFluffPreview(
            scenario === 'long' ? 'success' : scenario,
            scenario === 'long',
          )
        : null,
    [scenario],
  );
  if (!__DEV__) return <Redirect href="/" />;
  if (demo)
    return (
      <NightMorningFlow
        demo={demo}
        initialCount={6}
        onExit={() => setScenario(null)}
      />
    );
  if (preview)
    return (
      <FeedScreen
        load={preview.load}
        fluff={preview.fluff}
        yarn={preview.yarn}
        onProgress={preview.progress}
        onBack={() => setScenario(null)}
      />
    );
  return (
    <NightScreen>
      <ScrollView contentContainerStyle={styles.content}>
        <Notice
          title="솜털과 아침 후보 미리보기"
          description="본 카드에 솜털을 붙였다 떼어 보고, 밤부터 시연에서 마무리 개수와 다음 아침 후보 순서를 확인해요. 솜털은 후보 순서에만 영향을 주고 기본 선택은 마지막 따뜻한 카드예요. 기록은 시연 안의 메모리에만 남아요. 밤 마감·오프라인·오류는 고정 예시이며 실제 시간이나 서버와 연결되지 않아요."
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
});

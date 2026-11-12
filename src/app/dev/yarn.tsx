import { useMemo, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { FeedScreen } from '../../features/night/feed/FeedScreen';
import { NightMorningFlow } from '../../features/demo/NightMorningFlow';
import { createNightMorningDemo } from '../../mocks/nightMorningDemo';
import { createYarnPreview, type YarnScenario } from '../../mocks/yarn';
import { Button } from '../../ui/Button';
import { NightScreen } from '../../ui/NightScreen';
import { Notice } from '../../ui/Notice';
const scenarios: readonly [YarnScenario | 'long', string][] = [
  ['success', '털실 보내기·취소'],
  ['slow', '5초 지연·이동·연타'],
  ['retry', '보내기 실패·재시도'],
  ['remove-retry', '취소 실패·재시도'],
  ['lost-response', '응답 유실·최종 선택 재시도'],
  ['offline', '오프라인 예시'],
  ['unavailable', '삭제된 카드 응답'],
  ['long', '긴 글과 털실 반응'],
];
export default function YarnPreview() {
  const [scenario, setScenario] = useState<
    YarnScenario | 'long' | 'flow' | null
  >(null);
  const demo = useMemo(
    () => (scenario === 'flow' ? createNightMorningDemo('slow-yarn') : null),
    [scenario],
  );
  const preview = useMemo(
    () =>
      scenario && scenario !== 'flow'
        ? createYarnPreview(
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
        yarn={preview.yarn}
        onBack={() => setScenario(null)}
      />
    );
  return (
    <NightScreen>
      <ScrollView contentContainerStyle={styles.content}>
        <Notice
          title="털실 반응 미리보기"
          description="예시 카드에 보낸 상태만 메모리로 유지해요. 실제 전달·집계는 없어요. 밤부터 시연은 6마리·5초 지연으로 시작하고, 잠시 나갔다 이어 봐도 확정된 상태를 유지해요. 시연을 끝내거나 앱을 재실행하면 초기화돼요. 오류·오프라인은 고정 예시예요."
        />
        <Button label="밤부터 털실 시연" onPress={() => setScenario('flow')} />
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
  content: { padding: 20, gap: 20, flexGrow: 1, justifyContent: 'center' },
});

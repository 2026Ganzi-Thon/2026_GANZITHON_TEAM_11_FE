import { useMemo, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { MorningScreen } from '../../features/morning/MorningScreen';
import { NightMorningFlow } from '../../features/demo/NightMorningFlow';
import { createMockMorning } from '../../mocks/morning';
import { createMockFortune, type FortuneScenario } from '../../mocks/fortune';
import { createNightMorningDemo } from '../../mocks/nightMorningDemo';
import { createMockReceivedYarn } from '../../mocks/receivedYarn';
import { ApiError } from '../../api/errors';
import { NightScreen } from '../../ui/NightScreen';
import { Notice } from '../../ui/Notice';
import { Button } from '../../ui/Button';
type Scenario = FortuneScenario | 'adoption' | 'flock-retry' | 'yarn-wait';
const scenarios: readonly [Scenario, string][] = [
  ['success', '오늘의 운세 · 3위'],
  ['first', '오늘의 운세 · 1위'],
  ['second', '오늘의 운세 · 2위'],
  ['favorable', '순위 없음 · 순풍의 양'],
  ['relaxed', '순위 없음 · 느긋한 양'],
  ['resting', '순위 없음 · 쉬어 가는 양'],
  ['retry', '운세 조회 실패·재시도'],
  ['unavailable', '운세 준비 안 됨'],
  ['slow', '느린 운세 조회'],
  ['long', '긴 운세 문구'],
  ['next-day', '다른 날짜·별자리 예시'],
  ['adoption', '양 데려온 뒤 운세'],
  ['flock-retry', '양떼 실패·운세 정상'],
  ['yarn-wait', '운세 중 늦은 털실 도착'],
];
export default function FortunePreview() {
  const [scenario, setScenario] = useState<Scenario | 'night' | null>(null),
    [home, setHome] = useState(true);
  const actions = useMemo(() => {
    if (!scenario || scenario === 'night') return null;
    const base = createMockMorning(
      scenario === 'adoption' ? 'success' : 'existing',
    );
    let flockFailed = false;
    return {
      ...base,
      fortune: createMockFortune(
        scenario === 'adoption' ||
          scenario === 'flock-retry' ||
          scenario === 'yarn-wait'
          ? 'success'
          : scenario,
      ),
      receivedYarn:
        scenario === 'yarn-wait'
          ? createMockReceivedYarn('slow-load')
          : undefined,
      loadFlock: (signal: AbortSignal) => {
        if (scenario === 'flock-retry' && !flockFailed) {
          flockFailed = true;
          return Promise.reject(new ApiError('network'));
        }
        return base.loadFlock(signal);
      },
    };
  }, [scenario]);
  const demo = useMemo(
    () => (scenario === 'night' ? createNightMorningDemo('fortune') : null),
    [scenario],
  );
  if (!__DEV__) return <Redirect href="/" />;
  if (demo)
    return <NightMorningFlow demo={demo} onExit={() => setScenario(null)} />;
  if (actions && home)
    return (
      <MorningScreen
        actions={actions}
        loadDetail={actions.loadSheep}
        onExit={() => setHome(false)}
      />
    );
  return (
    <NightScreen>
      <ScrollView contentContainerStyle={styles.content}>
        <Notice
          title={actions ? '아침 확인을 마쳤어요' : '오늘의 운세 미리보기'}
          description="날짜·별자리·운세는 고정 예시예요. 실제 생일·04시 갱신·운세 생성·서버와 연결하지 않아요. 같은 시연을 다시 열면 같은 결과를 보여 줘요."
        />
        {actions ? (
          <>
            <Button label="아침 다시 열기" onPress={() => setHome(true)} />
            <Button
              label="시연 끝내기"
              onPress={() => {
                setScenario(null);
                setHome(true);
              }}
            />
          </>
        ) : (
          <>
            <Button
              label="밤부터 운세 확인"
              onPress={() => setScenario('night')}
            />
            {scenarios.map(([value, label]) => (
              <Button
                key={value}
                label={label}
                onPress={() => {
                  setHome(true);
                  setScenario(value);
                }}
              />
            ))}
            <Button
              label="시작 화면으로"
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace('/')
              }
            />
          </>
        )}
      </ScrollView>
    </NightScreen>
  );
}
const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 20, gap: 16 },
});

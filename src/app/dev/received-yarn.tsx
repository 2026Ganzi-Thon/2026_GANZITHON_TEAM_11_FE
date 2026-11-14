import { useMemo, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { MorningScreen } from '../../features/morning/MorningScreen';
import { createMockMorning } from '../../mocks/morning';
import {
  createMockReceivedYarn,
  type ReceivedYarnScenario,
} from '../../mocks/receivedYarn';
import { createNightMorningDemo } from '../../mocks/nightMorningDemo';
import { NightMorningFlow } from '../../features/demo/NightMorningFlow';
import { NightScreen } from '../../ui/NightScreen';
import { Notice } from '../../ui/Notice';
import { Button } from '../../ui/Button';
const scenarios: readonly [ReceivedYarnScenario, string][] = [
  ['success', '양 데려온 뒤 받은 털실'],
  ['none', '받은 털실 요약 없음'],
  ['zero', '받은 털실 0개'],
  ['seen', '이미 확인한 요약'],
  ['load-retry', '요약 조회 실패·재시도'],
  ['seen-retry', '확인 저장 실패·재시도'],
  ['seen-lost', '확인 응답 유실'],
  ['slow-load', '느린 요약 조회'],
  ['slow-seen', '느린 확인 저장'],
  ['large', '큰 털실 수치'],
];
export default function ReceivedYarnPreview() {
  const [scenario, setScenario] = useState<
    ReceivedYarnScenario | 'night' | null
  >(null);
  const [home, setHome] = useState(true);
  const actions = useMemo(
    () =>
      scenario && scenario !== 'night'
        ? {
            ...createMockMorning(),
            receivedYarn: createMockReceivedYarn(scenario),
          }
        : null,
    [scenario],
  );
  const demo = useMemo(
    () =>
      scenario === 'night' ? createNightMorningDemo('received-yarn') : null,
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
          title={actions ? '아침 확인을 마쳤어요' : '받은 털실 미리보기'}
          description="수치·확인 상태는 같은 시연의 메모리 예시예요. 실제 집계·서버·시간 판정·유저 간 전달·푸시와 연결하지 않아요. 시연을 끝내면 초기화돼요."
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
              label="밤부터 받은 털실 확인"
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

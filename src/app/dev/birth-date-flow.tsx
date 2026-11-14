import { useMemo, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { MorningScreen } from '../../features/morning/MorningScreen';
import {
  createBirthDateMorning,
  type BirthDateFlowScenario,
} from '../../mocks/birthDateMorning';
import { Button } from '../../ui/Button';
import { NightScreen } from '../../ui/NightScreen';
import { Notice } from '../../ui/Notice';
const scenarios: readonly [BirthDateFlowScenario, string][] = [
  ['success', '설정에서 생일 바꾸기'],
  ['exhausted', '생일 수정 횟수 소진'],
  ['lost-response', '생일 변경 응답 유실'],
  ['conflict', '생일 변경 횟수 충돌'],
  ['slow', '느린 생일 변경·뒤로가기'],
  ['profile-retry', '변경 후 설정 조회 실패'],
  ['fortune-retry', '변경 후 운세 조회 실패'],
];
export default function BirthDateFlowPreview() {
  const [scenario, setScenario] = useState<BirthDateFlowScenario | null>(null);
  const [home, setHome] = useState(true);
  const source = useMemo(
    () => (scenario ? createBirthDateMorning(scenario) : null),
    [scenario],
  );
  if (!__DEV__) return <Redirect href="/" />;
  if (source && home)
    return (
      <MorningScreen
        actions={source}
        loadDetail={source.loadSheep}
        onExit={() => setHome(false)}
      />
    );
  return (
    <NightScreen>
      <ScrollView contentContainerStyle={styles.content}>
        <Notice
          title={
            source ? '생일 연결 확인을 마쳤어요' : '생년월일·설정·운세 연결'
          }
          description="가상 생일과 고정 일일 운세 예시예요. 설정·생일 변경·운세가 같은 계정을 사용하고 아침을 다시 열어도 유지돼요. 실제 생일 입력·서버·운세 생성·영속 저장은 연결하지 않아요. 시연 종료 시 초기화돼요."
        />
        {source ? (
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
            {scenarios.map(([value, label]) => (
              <Button
                key={value}
                label={label}
                onPress={() => {
                  setScenario(value);
                  setHome(true);
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

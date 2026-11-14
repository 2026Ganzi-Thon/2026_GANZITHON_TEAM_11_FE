import { useMemo, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { BirthDateScreen } from '../../features/birthDate/BirthDateScreen';
import {
  createMockBirthDate,
  type BirthDateScenario,
} from '../../mocks/birthDate';
import { Button } from '../../ui/Button';
import { NightScreen } from '../../ui/NightScreen';
import { Notice } from '../../ui/Notice';
const scenarios: readonly [BirthDateScenario, string][] = [
  ['success', '생년월일 변경 · 수정 1회'],
  ['exhausted', '수정 횟수 소진'],
  ['load-retry', '생일 조회 실패·재시도'],
  ['save-retry', '변경 실패·같은 날짜 재시도'],
  ['lost-response', '변경 응답 유실·재확인'],
  ['slow', '느린 생일 변경'],
  ['conflict', '다른 변경과 횟수 충돌'],
  ['conflict-load-retry', '충돌 후 조회 실패'],
  ['validation-error', '날짜 검증 오류 응답'],
  ['age-rejected', '이용 연령 거절 응답'],
  ['invalid-response', '잘못된 저장 응답'],
];
export default function BirthDatePreview() {
  const [scenario, setScenario] = useState<BirthDateScenario | null>(null),
    [open, setOpen] = useState(true);
  const actions = useMemo(
    () => (scenario ? createMockBirthDate(scenario) : null),
    [scenario],
  );
  if (!__DEV__) return <Redirect href="/" />;
  if (actions && open)
    return <BirthDateScreen actions={actions} onBack={() => setOpen(false)} />;
  return (
    <NightScreen>
      <ScrollView contentContainerStyle={styles.content}>
        <Notice
          title={
            actions ? '생년월일 확인을 마쳤어요' : '생년월일 변경 미리보기'
          }
          description="고정 날짜·가상 프로필을 사용하는 독립 예시예요. 실제 생일은 입력하지 마세요. 설정·운세·계정·실제 서버와 연결하지 않으며, 나이 제한·별자리 결과는 API 제안과 mock 자료예요."
        />
        {actions ? (
          <>
            <Button label="같은 기록 다시 열기" onPress={() => setOpen(true)} />
            <Button
              label="시연 끝내기"
              onPress={() => {
                setScenario(null);
                setOpen(true);
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
                  setOpen(true);
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

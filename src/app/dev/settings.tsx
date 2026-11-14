import { useMemo, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { MorningScreen } from '../../features/morning/MorningScreen';
import { createSettingsMorning } from '../../mocks/settingsMorning';
import type { SettingsScenario } from '../../mocks/settings';
import { NightScreen } from '../../ui/NightScreen';
import { Notice } from '../../ui/Notice';
import { Button } from '../../ui/Button';
const scenarios: readonly [SettingsScenario, string][] = [
  ['success', '설정·고민 목록'],
  ['empty', '빈 고민 목록'],
  ['profile-retry', '설정 조회 실패·재시도'],
  ['list-retry', '목록 조회 실패·재시도'],
  ['paged', '고민 목록 더 보기'],
  ['more-retry', '더 보기 실패·재시도'],
  ['slow', '느린 설정·목록 조회'],
  ['long', '긴 고민·이메일'],
  ['delete-retry', '삭제 실패·재시도'],
  ['delete-lost', '삭제 응답 유실·재확인'],
  ['delete-slow', '느린 고민 삭제'],
  ['refresh-retry', '삭제 후 목록 재조회 실패'],
  ['count-retry', '삭제 후 개수 재조회 실패'],
];
export default function SettingsPreview() {
  const [scenario, setScenario] = useState<SettingsScenario | null>(null),
    [home, setHome] = useState(true);
  const actions = useMemo(
    () => (scenario ? createSettingsMorning(scenario) : null),
    [scenario],
  );
  if (!__DEV__) return <Redirect href="/" />;
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
          title={actions ? '아침 확인을 마쳤어요' : '설정·고민 목록 미리보기'}
          description="프로필과 고민 기록은 고정 예시예요. 원문 삭제를 설정·상세·회고에 함께 반영해요. 알림·계정 변경·실제 서버와 연결하지 않아요. 시연 종료 시 초기화돼요."
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

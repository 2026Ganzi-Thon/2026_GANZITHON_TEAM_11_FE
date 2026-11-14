import { useMemo, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { MorningScreen } from '../../features/morning/MorningScreen';
import { createSettingsMorning } from '../../mocks/settingsMorning';
import {
  createMockReminder,
  type ReminderScenario,
} from '../../mocks/reminder';
import { NightScreen } from '../../ui/NightScreen';
import { Notice } from '../../ui/Notice';
import { Button } from '../../ui/Button';
const scenarios: readonly [ReminderScenario, string][] = [
  ['success', '알림 설정·저장'],
  ['enabled', '기존 알림 시간 변경·끄기'],
  ['denied', '기기 권한 거절 예시'],
  ['undetermined', '기기 권한 미요청 예시'],
  ['load-retry', '알림 설정 조회 실패'],
  ['save-retry', '알림 저장 실패·재시도'],
  ['lost-response', '알림 저장 응답 유실'],
  ['slow', '느린 알림 저장·뒤로가기'],
  ['permission-retry', '기기 권한 조회 실패'],
  ['invalid-response', '잘못된 알림 저장 응답'],
  ['validation', '알림 시간 검증 오류'],
];
export default function ReminderPreview() {
  const [scenario, setScenario] = useState<ReminderScenario | null>(null),
    [home, setHome] = useState(true);
  const actions = useMemo(
    () =>
      scenario
        ? createSettingsMorning('success', {
            reminder: createMockReminder(scenario),
          })
        : null,
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
          title={actions ? '아침 확인을 마쳤어요' : '알림 설정 미리보기'}
          description="아침 홈의 설정에서 밤에 와 알림을 열어 주세요. 희망 설정과 기기 권한은 메모리 예시예요. 실제 권한 요청·알림 예약은 하지 않아요. 시연 종료 시 초기화돼요."
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

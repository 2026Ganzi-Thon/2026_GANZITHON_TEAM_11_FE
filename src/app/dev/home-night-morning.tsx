import { useMemo, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { ScrollView } from 'react-native';
import {
  HomeNightJourney,
  type HomeNightJourneySource,
} from '../../features/home/HomeNightJourney';
import {
  createMockHomeJourney,
  type HomeJourneyScenario,
} from '../../mocks/homeJourney';
import { getNativeReminderSession } from '../../notifications/nativeRuntime';
import { NightScreen } from '../../ui/NightScreen';
import { Notice } from '../../ui/Notice';
import { Button } from '../../ui/Button';
export default function HomeJourneyPreview() {
  const native = useMemo(
    () => (__DEV__ ? getNativeReminderSession() : null),
    [],
  );
  const [source, setSource] = useState<HomeNightJourneySource | null>(null),
    [open, setOpen] = useState(false);
  if (!__DEV__ || !native) return <Redirect href="/" />;
  if (source && open)
    return <HomeNightJourney source={source} onExit={() => setOpen(false)} />;
  const start = (scenario: HomeJourneyScenario) => {
    setSource(createMockHomeJourney(scenario, { reminder: native.reminder }));
    setOpen(true);
  };
  return (
    <NightScreen>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20, gap: 16 }}>
        <Notice
          title="첫 홈 → 밤 → 아침"
          description="같은 예시 계정의 밤 기록·양떼·회고·고민 목록을 이어 봐요. 낮·밤 시각과 데이터는 메모리 mock이며 다음 아침 이동은 시연용입니다. 홈으로 돌아와도 같은 시연의 진행을 유지해요. 앱 재실행 복원·실제 서버·새 카드의 내 카드 목록 통합은 연결하지 않았어요. 알림 권한·기기 예약은 실제로 동작해요."
        />
        {source && (
          <Button
            label="같은 계정 홈 다시 열기"
            onPress={() => setOpen(true)}
          />
        )}
        <Button label="첫 홈부터 시작" onPress={() => start('success')} />
        <Button
          label="마무리·채택 응답 유실"
          onPress={() => start('lost-responses')}
        />
        <Button
          label="홈 조회 실패·재시도"
          onPress={() => start('home-retry')}
        />
        <Button
          label="다음 아침 조회 실패"
          onPress={() => start('morning-retry')}
        />
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

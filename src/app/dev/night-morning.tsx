import { useMemo, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { NightMorningFlow } from '../../features/demo/NightMorningFlow';
import {
  createNightMorningDemo,
  type DemoScenario,
} from '../../mocks/nightMorningDemo';
import { NightScreen } from '../../ui/NightScreen';
import { Notice } from '../../ui/Notice';
import { Button } from '../../ui/Button';
export default function NightMorningPreview() {
  const [scenario, setScenario] = useState<DemoScenario | null>(null);
  const demo = useMemo(
    () => (scenario ? createNightMorningDemo(scenario) : null),
    [scenario],
  );
  if (!__DEV__) return <Redirect href="/" />;
  if (demo)
    return <NightMorningFlow demo={demo} onExit={() => setScenario(null)} />;
  return (
    <NightScreen>
      <ScrollView contentContainerStyle={styles.content}>
        <Notice
          title="밤부터 아침까지 이어 봐요"
          description="가상의 고민으로 확인해 주세요. 입력과 기록은 이 시연 안에서만 유지돼요. 다음 아침 이동은 개발용이며 실제 시간·안전 검사·서버·로그인·영속 저장과 연결되지 않아요. 시연을 끝내면 초기화돼요."
        />
        <Button
          label="밤→아침 시연 시작"
          onPress={() => setScenario('success')}
        />
        <Button
          label="종료·채택 응답 유실 시연"
          onPress={() => setScenario('lost-responses')}
        />
        <Button
          label="아침 작성 접수 실패·재시도"
          onPress={() => setScenario('writing-retry')}
        />
        <Button
          label="아침 작성 응답 유실"
          onPress={() => setScenario('writing-lost-response')}
        />
        <Button
          label="아침 작성 후 상태 조회 실패"
          onPress={() => setScenario('writing-refresh-retry')}
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
const styles = StyleSheet.create({
  content: { padding: 20, gap: 24, flexGrow: 1, justifyContent: 'center' },
});

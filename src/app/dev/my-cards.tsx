import { useMemo, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { MyCardsScreen } from '../../features/myCards/MyCardsScreen';
import { createMockMyCards, type MyCardsScenario } from '../../mocks/myCards';
import { NightScreen } from '../../ui/NightScreen';
import { Notice } from '../../ui/Notice';
import { Button } from '../../ui/Button';
const scenarios = [
  ['success', '내 카드 목록'],
  ['empty', '빈 목록'],
  ['load-retry', '첫 조회 실패·재시도'],
  ['more-retry', '추가 조회 실패·재시도'],
  ['slow', '느린 조회·필터 전환'],
  ['long', '긴 글·곡 정보·반려 사유'],
] as const;
export default function MyCardsPreview() {
  const [scenario, setScenario] = useState<MyCardsScenario | null>(null);
  const actions = useMemo(
    () => (scenario ? createMockMyCards(scenario) : null),
    [scenario],
  );
  if (!__DEV__) return <Redirect href="/" />;
  if (actions)
    return <MyCardsScreen actions={actions} onBack={() => setScenario(null)} />;
  return (
    <NightScreen>
      <ScrollView contentContainerStyle={styles.content}>
        <Notice
          title="내 카드와 검수 상태"
          description="메모리 예시 목록이에요. 실제 작성 기록·검수·받은 털실은 연결하지 않았어요. 삭제·재제출·새 글 작성은 후속 범위예요."
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
  content: { flexGrow: 1, justifyContent: 'center', padding: 20, gap: 20 },
});

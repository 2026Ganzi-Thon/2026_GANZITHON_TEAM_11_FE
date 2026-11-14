import { useMemo, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { MyCardsWritingFlow } from '../../features/myCards/MyCardsWritingFlow';
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
  ['delete-retry', '삭제 실패·재시도'],
  ['slow-delete', '느린 삭제·중복 방지'],
  ['lost-delete', '삭제 응답 유실·재시도'],
  ['delete-refresh-retry', '삭제 후 목록 조회 실패'],
  ['single', '마지막 카드 삭제'],
  ['write-retry', '카드 작성 접수 실패·재시도'],
  ['write-lost-response', '카드 작성 응답 유실'],
  ['write-refresh-retry', '작성 후 목록 조회 실패'],
  ['write-slow', '느린 카드 접수·중복 방지'],
  ['write-empty-search', '곡 직접 입력 후 목록 반영'],
] as const;
export default function MyCardsPreview() {
  const [scenario, setScenario] = useState<MyCardsScenario | null>(null);
  const actions = useMemo(
    () => (scenario ? createMockMyCards(scenario) : null),
    [scenario],
  );
  if (!__DEV__) return <Redirect href="/" />;
  if (actions)
    return (
      <MyCardsWritingFlow source={actions} onBack={() => setScenario(null)} />
    );
  return (
    <NightScreen>
      <ScrollView contentContainerStyle={styles.content}>
        <Notice
          title="내 카드와 검수 상태"
          description="글·노래 작성과 목록·삭제를 같은 메모리 예시로 연결해요. 접수한 카드는 검수 중으로 표시돼요. 실제 서버·곡 검색·검수·영속 저장과 연결되지 않으며 시연을 끝내면 초기화돼요. 밤·아침 시연의 기록과 재제출 연결은 후속 범위예요."
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

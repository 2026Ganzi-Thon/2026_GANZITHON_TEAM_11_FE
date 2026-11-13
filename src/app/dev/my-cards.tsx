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
  ['delete-retry', '삭제 실패·재시도'],
  ['slow-delete', '느린 삭제·중복 방지'],
  ['lost-delete', '삭제 응답 유실·재시도'],
  ['delete-refresh-retry', '삭제 후 목록 조회 실패'],
  ['single', '마지막 카드 삭제'],
  ['resubmit-retry', '재제출 실패·초안 유지'],
  ['lost-resubmit', '재제출 응답 유실·재시도'],
  ['slow-resubmit', '느린 재제출·중복 방지'],
  ['resubmit-approved', '편집 중 게시 상태로 변경'],
  ['resubmit-deleted', '편집 중 카드 삭제'],
  ['resubmit-field', '재제출 입력 오류'],
  ['resubmit-safety', '재제출 검수 일시 불가'],
  ['resubmit-support', '재제출 도움 안내·초안 복귀'],
  ['resubmit-refresh-retry', '재제출 후 목록 조회 실패'],
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
      <MyCardsScreen
        actions={actions}
        deletions={actions}
        resubmissions={actions}
        onBack={() => setScenario(null)}
      />
    );
  return (
    <NightScreen>
      <ScrollView contentContainerStyle={styles.content}>
        <Notice
          title="내 카드와 검수 상태"
          description="메모리 예시 목록·삭제·반려 글 재제출이에요. 같은 시연의 조회 결과에 반영되며 다시 시작하면 초기화돼요. 실제 작성 기록·검수·털실·피드와 연결되지 않았어요. 반려된 글은 같은 카드로 다시 검수받아요. 새 글·노래 수정은 후속 범위예요."
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

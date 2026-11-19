import { canUseMock } from '../../config/runtime';
import { useMemo, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { MorningScreen } from '../../features/morning/MorningScreen';
import { createMockMyCards } from '../../mocks/myCards';
import { createMockMorning } from '../../mocks/morning';
import type { DetailScenario } from '../../mocks/sheepDetail';
import { Button } from '../../ui/Button';
import { NightScreen } from '../../ui/NightScreen';
import { Notice } from '../../ui/Notice';
import { theme } from '../../ui/theme';
type Scenario = DetailScenario | 'write-lost-response' | 'write-slow';
const scenarios: readonly { label: string; value: Scenario }[] = [
  { label: '카드·곡 읽기·새 카드 쓰기', value: 'success' },
  { label: '상세 작성 응답 유실·복구', value: 'write-lost-response' },
  { label: '상세 작성 중 뒤로 가기', value: 'write-slow' },
  { label: '상세 조회 실패·재시도', value: 'retry' },
  { label: '찾을 수 없는 양', value: 'missing' },
  { label: '삭제된 카드', value: 'unavailable' },
  { label: '삭제된 고민', value: 'deleted-worry' },
  { label: '고민 없는 밤', value: 'no-worry' },
  { label: '기존 돌아보기', value: 'reflection' },
  { label: '긴 카드·고민', value: 'long' },
  { label: '마무리 카드 순번 없음', value: 'closing' },
];
export default function SheepDetailPreview() {
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const actions = useMemo(
    () =>
      scenario
        ? createMockMorning(
            'existing',
            scenario === 'write-lost-response' || scenario === 'write-slow'
              ? 'success'
              : scenario,
          )
        : null,
    [scenario],
  );
  const cards = useMemo(
    () =>
      scenario
        ? createMockMyCards(
            scenario === 'write-lost-response' || scenario === 'write-slow'
              ? scenario
              : 'empty',
          )
        : undefined,
    [scenario],
  );
  if (!canUseMock()) return <Redirect href="/" />;
  if (actions)
    return (
      <MorningScreen
        actions={actions}
        myCards={cards}
        loadDetail={actions.loadSheep}
        onExit={() => setScenario(null)}
      />
    );
  return (
    <NightScreen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          양 상세 미리보기
        </Text>
        <Notice
          title="양떼에서 양을 눌러 보세요"
          description="양 상세에서 새 글·노래 카드를 쓰고 같은 예시 계정의 내 카드에서 확인해요. 지난 밤 기록은 바꾸지 않아요. 초안은 양마다 같은 시연 안에서 유지되며, 서버·곡 검색·영속 저장은 연결하지 않았어요."
        />
        {scenarios.map(({ label, value }) => (
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
  content: { flexGrow: 1, padding: 20, gap: 14 },
  title: {
    fontFamily: theme.font,
    fontSize: 24,
    lineHeight: 34,
    fontWeight: '700',
    color: theme.color.text,
  },
});

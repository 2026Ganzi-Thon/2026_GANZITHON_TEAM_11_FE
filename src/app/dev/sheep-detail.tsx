import { useMemo, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { MorningScreen } from '../../features/morning/MorningScreen';
import { createMockMorning } from '../../mocks/morning';
import type { DetailScenario } from '../../mocks/sheepDetail';
import { Button } from '../../ui/Button';
import { NightScreen } from '../../ui/NightScreen';
import { Notice } from '../../ui/Notice';
import { theme } from '../../ui/theme';
const scenarios: readonly { label: string; value: DetailScenario }[] = [
  { label: '카드·곡 다시 읽기', value: 'success' },
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
  const [scenario, setScenario] = useState<DetailScenario | null>(null);
  const actions = useMemo(
    () => (scenario ? createMockMorning('existing', scenario) : null),
    [scenario],
  );
  if (!__DEV__) return <Redirect href="/" />;
  if (actions)
    return (
      <MorningScreen
        actions={actions}
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
          description="첫 양에는 곡이, 나머지 양에는 글이 담겨 있어요. 지난 고민과 기록을 읽는 화면이며 삭제·회고 작성·꾸미기·카드 작성은 하지 않아요."
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

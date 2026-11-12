import { useMemo, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { MorningScreen } from '../../features/morning/MorningScreen';
import { createMockMorning } from '../../mocks/morning';
import type { ReflectionScenario } from '../../mocks/reflection';
import { Button } from '../../ui/Button';
import { NightScreen } from '../../ui/NightScreen';
import { Notice } from '../../ui/Notice';
import { theme } from '../../ui/theme';
const scenarios: readonly { label: string; value: ReflectionScenario }[] = [
  { label: '회고 선택·저장', value: 'success' },
  { label: '회고 저장 실패·재시도', value: 'save-retry' },
  { label: '회고 조회 실패·재시도', value: 'load-retry' },
  { label: '고민 없는 밤', value: 'no-worry' },
  { label: '삭제된 고민', value: 'deleted-worry' },
  { label: '이미 남긴 회고', value: 'existing' },
  { label: '긴 고민 돌아보기', value: 'long' },
  { label: '저장 중 회고 불가', value: 'unavailable' },
];
export default function MorningReflectionPreview() {
  const [scenario, setScenario] = useState<ReflectionScenario | null>(null);
  const actions = useMemo(
    () =>
      scenario ? createMockMorning('existing', 'success', scenario) : null,
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
          아침 회고 미리보기
        </Text>
        <Notice
          title="어젯밤 돌아보기를 눌러 보세요"
          description="회고를 남긴 뒤 첫 양을 누르면 같은 답을 다시 볼 수 있어요. 메모리 예시라 미리보기를 나가면 초기화돼요."
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

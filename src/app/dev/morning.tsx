import { useMemo, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { MorningScreen } from '../../features/morning/MorningScreen';
import { createMockMorning, type MorningScenario } from '../../mocks/morning';
import { Button } from '../../ui/Button';
import { NightScreen } from '../../ui/NightScreen';
import { Notice } from '../../ui/Notice';
import { theme } from '../../ui/theme';
const scenarios: readonly { label: string; value: MorningScenario }[] = [
  { label: '양 선택·데려오기', value: 'success' },
  { label: '아침 기록 조회 실패', value: 'load-retry' },
  { label: '데려오기 응답 유실', value: 'save-lost' },
  { label: '양떼 조회 실패', value: 'flock-retry' },
  { label: '다른 선택이 먼저 확정됨', value: 'conflict' },
  { label: '선택할 수 없는 카드', value: 'unavailable' },
  { label: '후보 없는 아침', value: 'no-candidates' },
  { label: '기록·양떼 없음', value: 'empty' },
  { label: '이미 데려온 아침', value: 'existing' },
  { label: '긴 카드 본문', value: 'long' },
];
export default function MorningPreview() {
  const [scenario, setScenario] = useState<MorningScenario | null>(null);
  const actions = useMemo(
    () => (scenario ? createMockMorning(scenario) : null),
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
          아침·양떼 미리보기
        </Text>
        <Notice
          title="예시 기록으로 확인해요"
          description="실제 밤 기록·서버·로그인과 연결되지 않아요. 시나리오를 나갔다 들어오면 초기화돼요. 데려온 양을 누르면 담긴 기록을 볼 수 있어요. 자동 데려오기·꾸미기·운세는 포함하지 않아요."
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

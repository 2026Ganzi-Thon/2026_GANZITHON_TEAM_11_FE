import { useMemo, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { NightEntryScreen } from '../../features/night/NightEntryScreen';
import {
  createMockNightEntry,
  type NightEntryScenario,
} from '../../mocks/nightEntry';
import { Button } from '../../ui/Button';
import { NightScreen } from '../../ui/NightScreen';
import { Notice } from '../../ui/Notice';
import { theme } from '../../ui/theme';
import { createMockNightFeed } from '../../mocks/nightFeed';
import { createMockNightClosing } from '../../mocks/nightClosing';
const supportScenarios: readonly [NightEntryScenario, string][] = [
  ['support', '도움 안내 → 양 수 선택'],
  ['continue-retry', '계속하기 실패·재시도'],
  ['continue-lost-response', '계속하기 응답 유실'],
  ['slow-continue', '느린 계속하기·뒤로가기'],
  ['support-missing', '도움 정보 누락·다시 불러오기'],
  ['support-reload-retry', '도움 정보 재조회 실패'],
  ['support-long', '긴 도움 안내'],
];

export default function NightEntryPreview() {
  const [scenario, setScenario] = useState<NightEntryScenario | null>(null);
  const actions = useMemo(
    () => (scenario ? createMockNightEntry(scenario) : null),
    [scenario],
  );
  const closingActions = useMemo(() => createMockNightClosing(), []);
  if (!__DEV__) return <Redirect href="/" />;
  if (actions)
    return (
      <NightEntryScreen
        actions={actions}
        onBack={() => setScenario(null)}
        createFeed={createMockNightFeed}
        closingActions={closingActions}
      />
    );
  return (
    <NightScreen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          오늘 밤 화면 미리보기
        </Text>
        <Notice
          title="가상의 고민으로 확인해 주세요"
          description="예시 응답으로 화면만 확인합니다. 도움 안내는 입력 내용과 무관한 고정 시나리오이며 기기 앱 열기는 실제로 동작해요. 실제 저장·안전 확인은 수행하지 않습니다. 입력은 미리보기를 닫으면 사라집니다. 글자 수 제한은 확정 전 임시 200자입니다."
        />
        <Button label="성공 응답" onPress={() => setScenario('success')} />
        <Button
          label="고민 입력 실패 후 재시도"
          onPress={() => setScenario('worry-retry')}
        />
        <Button
          label="양 세기 준비 실패 후 재시도"
          onPress={() => setScenario('count-retry')}
        />
        {supportScenarios.map(([value, label]) => (
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
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: theme.gutter,
    gap: 16,
  },
  title: {
    fontFamily: theme.font,
    fontWeight: '700',
    fontSize: 24,
    lineHeight: 34,
    color: theme.color.text,
  },
});

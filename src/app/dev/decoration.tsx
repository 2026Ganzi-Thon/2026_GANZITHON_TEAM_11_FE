import { useMemo, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { canUseMock } from '../../config/runtime';
import { MorningScreen } from '../../features/morning/MorningScreen';
import { createMockMorning } from '../../mocks/morning';
import {
  withMockDecoration,
  type DecorationScenario,
} from '../../mocks/decoration';
import { Button } from '../../ui/Button';
import { NightScreen } from '../../ui/NightScreen';
import { Notice } from '../../ui/Notice';
import { theme } from '../../ui/theme';
export default function DecorationPreview() {
  const [scenario, setScenario] = useState<DecorationScenario | null>(null);
  const source = useMemo(
    () =>
      scenario
        ? withMockDecoration(createMockMorning('existing'), { scenario })
        : null,
    [scenario],
  );
  if (!canUseMock()) return <Redirect href="/" />;
  if (source)
    return (
      <MorningScreen
        actions={source}
        loadDetail={source.loadSheep}
        onExit={() => setScenario(null)}
      />
    );
  return (
    <NightScreen>
      <ScrollView contentContainerStyle={s.content}>
        <Text accessibilityRole="header" style={s.title}>
          양 꾸미기 미리보기
        </Text>
        <Notice
          title="가상의 양떼로 확인해요"
          description="스티커와 저장은 mock이에요. 시연 종료·앱 재실행 시 초기화되며 실제 서버와 연결하지 않아요. 양 꾸미기에서 양을 고른 뒤 스티커를 끌어 놓거나 눌러 붙여 보세요."
        />
        {(
          [
            ['꾸미기·저장·양떼 반영', 'success'],
            ['꾸미기 조회 실패', 'load-retry'],
            ['저장 실패 후 상태 확인', 'save-retry'],
            ['저장 응답 유실 복구', 'save-lost'],
            ['느린 꾸미기 저장', 'slow'],
            ['배치 버전 충돌', 'conflict'],
            ['저장 상태 조회 재시도', 'verify-retry'],
            ['밤에는 저장 차단', 'night'],
          ] as const
        ).map(([label, value]) => (
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
const s = StyleSheet.create({
  content: { padding: 20, gap: 14 },
  title: {
    fontFamily: theme.font,
    fontSize: 24,
    lineHeight: 34,
    color: theme.color.text,
    fontWeight: '700',
  },
});

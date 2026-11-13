import { useMemo, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { TextCardScreen } from '../../features/cards/TextCardScreen';
import { NightMorningFlow } from '../../features/demo/NightMorningFlow';
import {
  createMockTextCards,
  type TextCardScenario,
} from '../../mocks/textCards';
import { createNightMorningDemo } from '../../mocks/nightMorningDemo';
import { NightScreen } from '../../ui/NightScreen';
import { Button } from '../../ui/Button';
import { Notice } from '../../ui/Notice';
const scenarios: readonly [TextCardScenario, string][] = [
  ['success', '짧은 글 쓰기'],
  ['retry', '접수 실패·재시도'],
  ['lost-response', '응답 유실·재시도'],
  ['field-error', '입력 오류 안내'],
  ['support', '도움 안내·초안 복귀'],
  ['safety-unavailable', '검수 요청 불가·재시도'],
  ['entry-required', '작성 진입 만료 안내'],
];
export default function TextCardPreview() {
  const [scenario, setScenario] = useState<TextCardScenario | 'flow' | null>(
    null,
  );
  const actions = useMemo(
    () =>
      scenario && scenario !== 'flow' ? createMockTextCards(scenario) : null,
    [scenario],
  );
  const demo = useMemo(
    () => (scenario === 'flow' ? createNightMorningDemo() : null),
    [scenario],
  );
  if (!__DEV__) return <Redirect href="/" />;
  if (demo)
    return <NightMorningFlow demo={demo} onExit={() => setScenario(null)} />;
  if (actions)
    return (
      <TextCardScreen
        actions={actions}
        sourceNightId="preview-night"
        onBack={() => setScenario(null)}
        onDone={() => setScenario(null)}
      />
    );
  return (
    <NightScreen>
      <ScrollView contentContainerStyle={styles.content}>
        <Notice
          title="짧은 글 카드 미리보기"
          description="Figma의 200자를 임시 기준으로 확인해요. 실제 전송·안전 검사 없이 메모리에서 초안과 검수 대기 접수를 시연해요. 오류·도움 안내는 입력 내용과 무관한 고정 시나리오예요."
        />
        <Button
          label="밤부터 글 카드 쓰기 시연"
          onPress={() => setScenario('flow')}
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
  content: { padding: 20, gap: 20, flexGrow: 1, justifyContent: 'center' },
});

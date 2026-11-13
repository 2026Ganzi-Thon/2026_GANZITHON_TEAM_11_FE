import { useMemo, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { CardWritingScreen } from '../../features/cards/CardWritingScreen';
import { NightMorningFlow } from '../../features/demo/NightMorningFlow';
import {
  createMockSongCards,
  type SongCardScenario,
} from '../../mocks/songCards';
import { createMockTextCards } from '../../mocks/textCards';
import { createMockCardWriting } from '../../mocks/cardWriting';
import { createNightMorningDemo } from '../../mocks/nightMorningDemo';
import { NightScreen } from '../../ui/NightScreen';
import { Notice } from '../../ui/Notice';
import { Button } from '../../ui/Button';
const scenarios: readonly [SongCardScenario, string][] = [
  ['success', '곡 검색·노래 추천 작성'],
  ['empty', '검색 결과 없음·직접 입력'],
  ['search-retry', '검색 실패·재시도'],
  ['slow-search', '느린 검색·검색어 변경'],
  ['long', '긴 곡명·가수'],
  ['retry', '노래 접수 실패·재시도'],
  ['lost-response', '노래 접수 응답 유실'],
  ['slow-submit', '느린 노래 접수·중복 방지'],
  ['field-error', '추천 문장 입력 오류'],
  ['safety-unavailable', '노래 검수 요청 불가'],
  ['support', '노래 도움 안내·초안 복귀'],
  ['entry-required', '노래 작성 진입 만료'],
];
export default function SongCardPreview() {
  const [scenario, setScenario] = useState<SongCardScenario | 'flow' | null>(
    null,
  );
  const actions = useMemo(() => {
    if (!scenario || scenario === 'flow') return null;
    let fulfilled = false;
    const offer = {
      canSubmit: () => !fulfilled,
      onSubmitted: () => {
        fulfilled = true;
      },
    };
    return createMockCardWriting(
      createMockTextCards('success', offer),
      createMockSongCards(scenario, offer),
    );
  }, [scenario]);
  const demo = useMemo(
    () => (scenario === 'flow' ? createNightMorningDemo() : null),
    [scenario],
  );
  if (!__DEV__) return <Redirect href="/" />;
  if (demo)
    return <NightMorningFlow demo={demo} onExit={() => setScenario(null)} />;
  if (actions)
    return (
      <CardWritingScreen
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
          title="노래 카드 추천 미리보기"
          description="곡 검색·검수는 입력 내용과 무관한 메모리 예시예요. 실제 음악 API·음원·가사·서버와 연결하지 않아요. 시연을 나가면 초안과 접수 결과가 초기화돼요."
        />
        <Button
          label="밤부터 노래 카드 쓰기 시연"
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

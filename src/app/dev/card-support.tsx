import { useMemo, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { CardWritingScreen } from '../../features/cards/CardWritingScreen';
import { SupportContent } from '../../features/support/SupportContent';
import { createMockCardWriting } from '../../mocks/cardWriting';
import { createMockTextCards } from '../../mocks/textCards';
import { createMockSongCards } from '../../mocks/songCards';
import { createMockSupport } from '../../mocks/support';
import { Button } from '../../ui/Button';
import { NightScreen } from '../../ui/NightScreen';
import { Notice } from '../../ui/Notice';
const choices = [
  ['text', '글 작성 → 도움 안내'],
  ['song', '노래 작성 → 도움 안내'],
  ['long', '긴 도움 안내'],
  ['missing', '안내 데이터 누락'],
  ['unavailable', '열 수 없는 도움 항목'],
  ['launch-error', '앱 열기 실패 예시'],
] as const;
type Scenario = (typeof choices)[number][0];
export default function SupportPreview() {
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const actions = useMemo(() => {
    if (scenario !== 'text' && scenario !== 'song') return null;
    const text = createMockTextCards('support'),
      song = createMockSongCards('support');
    text.writeDraft({
      ...text.readDraft(),
      category_id: 'career',
      text: '내 속도로 쉬어 가도 괜찮아요.',
    });
    song.writeDraft({
      ...song.readDraft(),
      category_id: 'career',
      selection: {
        mode: 'manual',
        title: '시연용 노래',
        artist: '시연용 가수',
      },
      recommendation: '잠시 숨을 고를 때 들으면 좋겠어요.',
    });
    const writing = createMockCardWriting(text, song);
    writing.choose({ kind: scenario, category_id: 'career' });
    return writing;
  }, [scenario]);
  if (!__DEV__) return <Redirect href="/" />;
  if (actions)
    return (
      <CardWritingScreen
        actions={actions}
        sourceNightId="preview-night"
        onBack={() => setScenario(null)}
        onDone={() => setScenario(null)}
      />
    );
  const support = createMockSupport();
  if (scenario === 'long') {
    support.message = '지금은 잠시 쉬어 가도 괜찮아요. '.repeat(12);
    support.resources[1].label =
      '믿을 수 있는 친구나 가족에게 지금 내 마음을 이야기할 수 있도록 연락처 앱 열기';
  }
  if (scenario === 'unavailable')
    support.resources = [
      { label: '주소가 없는 도움 항목', action: 'open_url', target: null },
    ];
  return (
    <NightScreen>
      <ScrollView contentContainerStyle={styles.content}>
        {scenario ? (
          <SupportContent
            support={scenario === 'missing' ? undefined : support}
            onReturn={() => setScenario(null)}
            openResource={
              scenario === 'launch-error'
                ? async () => {
                    throw new Error('preview-launch-failed');
                  }
                : undefined
            }
          />
        ) : (
          <>
            <Notice
              title="공통 도움 안내 미리보기"
              description="입력 내용과 무관한 고정 지원 응답이에요. 도움 버튼은 실제 전화·연락처·브라우저 앱을 열어요. 전화는 자동 발신하지 않아요. 초안·검수는 메모리 예시로 유지해요."
            />
            {choices.map(([value, label]) => (
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
          </>
        )}
      </ScrollView>
    </NightScreen>
  );
}
const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 20, gap: 20 },
});

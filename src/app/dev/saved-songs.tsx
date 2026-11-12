import { useMemo, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { NightMorningFlow } from '../../features/demo/NightMorningFlow';
import { SavedSongsScreen } from '../../features/songs/SavedSongsScreen';
import { songExternal } from '../../features/songs/songExternal';
import { createNightMorningDemo } from '../../mocks/nightMorningDemo';
import {
  createMockSavedSongs,
  type SongScenario,
} from '../../mocks/savedSongs';
import { NightScreen } from '../../ui/NightScreen';
import { Button } from '../../ui/Button';
import { Notice } from '../../ui/Notice';
const failureIO = {
  open: async () => {
    throw new Error('Preview open failure');
  },
  copy: async () => {
    throw new Error('Preview copy failure');
  },
};
const scenarios: readonly [SongScenario, string][] = [
  ['success', '담은 노래 목록'],
  ['empty', '빈 목록'],
  ['load-retry', '목록 조회 실패·재시도'],
  ['remove-retry', '담기 취소 실패·재시도'],
  ['long', '긴 곡 정보'],
  ['external-fail', '연결·복사 실패 안내'],
];
export default function SavedSongsPreview() {
  const [scenario, setScenario] = useState<
    SongScenario | 'flow' | 'slow-flow' | null
  >(null);
  const demo = useMemo(
    () =>
      scenario === 'flow' || scenario === 'slow-flow'
        ? createNightMorningDemo(
            scenario === 'slow-flow' ? 'slow-songs' : 'success',
          )
        : null,
    [scenario],
  );
  const actions = useMemo(
    () =>
      scenario && scenario !== 'flow' && scenario !== 'slow-flow'
        ? createMockSavedSongs(scenario)
        : null,
    [scenario],
  );
  if (!__DEV__) return <Redirect href="/" />;
  if (demo)
    return (
      <NightMorningFlow
        demo={demo}
        initialCount={6}
        onExit={() => setScenario(null)}
      />
    );
  if (actions)
    return (
      <SavedSongsScreen
        actions={actions}
        external={scenario === 'external-fail' ? failureIO : songExternal}
        onBack={() => setScenario(null)}
      />
    );
  return (
    <NightScreen>
      <ScrollView contentContainerStyle={styles.content}>
        <Notice
          title="노래를 담고 아침에 다시 찾아봐요"
          description="밤부터 시작은 6마리 중 3·4번째 양에서 노래 담기를 확인해요. 목록 예시는 메모리 응답이며 Spotify 연결과 복사는 실제 기기 동작이에요. 연결·복사 실패 안내는 예시 실패만 표시해요."
        />
        <Button
          label="밤부터 노래 담기 시연"
          onPress={() => setScenario('flow')}
        />
        <Button
          label="느린 노래 담기 시연"
          onPress={() => setScenario('slow-flow')}
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

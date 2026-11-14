import { useMemo, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { MorningScreen } from '../../features/morning/MorningScreen';
import { NightMorningFlow } from '../../features/demo/NightMorningFlow';
import { createMockMorning } from '../../mocks/morning';
import { createNightMorningDemo } from '../../mocks/nightMorningDemo';
import { NightScreen } from '../../ui/NightScreen';
import { Notice } from '../../ui/Notice';
import { Button } from '../../ui/Button';
type Scenario =
  | 'saved'
  | 'empty-reflection'
  | 'retry'
  | 'lost-response'
  | 'slow'
  | 'long'
  | 'deleted-worry'
  | 'no-worry';
const scenarios: readonly [Scenario, string][] = [
  ['saved', '고민 삭제 · 저장된 회고'],
  ['empty-reflection', '고민 삭제 · 회고 없음'],
  ['retry', '삭제 실패·재시도'],
  ['lost-response', '삭제 응답 유실·재확인'],
  ['slow', '느린 삭제'],
  ['long', '긴 고민·카드 삭제'],
  ['deleted-worry', '이미 삭제된 고민'],
  ['no-worry', '고민 없는 밤'],
];
export default function WorryDeletionPreview() {
  const [scenario, setScenario] = useState<Scenario | 'night' | null>(null);
  const [home, setHome] = useState(true);
  const actions = useMemo(
    () =>
      scenario && scenario !== 'night'
        ? createMockMorning(
            scenario === 'long' ? 'long' : 'existing',
            'success',
            scenario === 'saved' ||
              scenario === 'retry' ||
              scenario === 'lost-response' ||
              scenario === 'slow'
              ? 'existing'
              : scenario === 'empty-reflection'
                ? 'success'
                : scenario,
            scenario === 'retry' ||
              scenario === 'lost-response' ||
              scenario === 'slow'
              ? scenario
              : 'success',
          )
        : null,
    [scenario],
  );
  const demo = useMemo(
    () =>
      scenario === 'night' ? createNightMorningDemo('worry-delete') : null,
    [scenario],
  );
  if (!__DEV__) return <Redirect href="/" />;
  if (demo)
    return <NightMorningFlow demo={demo} onExit={() => setScenario(null)} />;
  if (actions && home)
    return (
      <MorningScreen
        actions={actions}
        loadDetail={actions.loadSheep}
        onExit={() => setHome(false)}
      />
    );
  return (
    <NightScreen>
      <ScrollView contentContainerStyle={styles.content}>
        <Notice
          title={actions ? '아침 확인을 마쳤어요' : '고민 삭제 미리보기'}
          description="메모리의 고민 원문만 지워요. 양·카드·분류·저장된 회고는 남아요. 실제 서버·파생 데이터 삭제·영속 저장과 연결하지 않으며 시연 종료 시 초기화돼요."
        />
        {actions ? (
          <>
            <Button label="아침 다시 열기" onPress={() => setHome(true)} />
            <Button
              label="시연 끝내기"
              onPress={() => {
                setScenario(null);
                setHome(true);
              }}
            />
          </>
        ) : (
          <>
            <Button
              label="밤부터 고민 삭제 확인"
              onPress={() => setScenario('night')}
            />
            {scenarios.map(([value, label]) => (
              <Button
                key={value}
                label={label}
                onPress={() => {
                  setScenario(value);
                  setHome(true);
                }}
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
  content: { flexGrow: 1, padding: 20, gap: 16 },
});

import { useState } from 'react';
import { ScrollView } from 'react-native';
import {
  createMockNightReturn,
  type NightReturnScenario,
} from '../../../mocks/nightReturn';
import { NightScreen } from '../../../ui/NightScreen';
import { Notice } from '../../../ui/Notice';
import { Button } from '../../../ui/Button';
import { NightReturnFlow } from './NightReturnFlow';
import type { ReturnOutcome } from './useNightReturn';
const presets: readonly { label: string; value: NightReturnScenario }[] = [
  { label: '다 센 밤 재방문', value: 'completed' },
  { label: '중도 종료한 밤 재방문', value: 'stopped' },
  { label: '맡긴 걱정 없는 밤', value: 'unentrusted' },
  { label: '첫 조회 실패·재시도', value: 'initial-error' },
  { label: '다시 세기 확인 실패', value: 'retry' },
  { label: '느린 조회·닫기', value: 'slow' },
  { label: '확인 중 기록 갱신', value: 'changed' },
  { label: '확인 중 04시 전환', value: 'expired-on-check' },
  { label: '확인 중 활성 세션 발견', value: 'active-on-check' },
  { label: '마무리 확인이 남은 밤', value: 'closing' },
  { label: '도움 안내 먼저', value: 'support' },
  { label: '04시 이후 진입', value: 'day' },
];
function title(next: ReturnOutcome): string {
  switch (next.kind) {
    case 'restart':
      return `${next.count}마리 선택을 확인했어요`;
    case 'feed':
      return '세던 양을 이어 볼 차례예요';
    case 'closing':
      return '마무리를 먼저 확인해요';
    case 'morning':
      return '아침으로 갈 시간이에요';
    case 'support':
      return '도움 안내를 먼저 확인해요';
    case 'entry':
      return next.step === 'count'
        ? '양 수를 고를 차례예요'
        : '오늘 밤 고민을 적을 차례예요';
    case 'home':
      return '홈으로 돌아갈 차례예요';
  }
}
export function NightReturnPreview({ onExit }: { onExit: () => void }) {
  const [actions, setActions] = useState<ReturnType<
      typeof createMockNightReturn
    > | null>(null),
    [next, setNext] = useState<ReturnOutcome | null>(null);
  const menu = () => {
    setActions(null);
    setNext(null);
  };
  if (next)
    return (
      <NightScreen>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            padding: 20,
            gap: 20,
          }}
        >
          <Notice
            title={title(next)}
            description="이 독립 미리보기에서는 선택한 값과 다음 목적지까지만 확인해요. 새 세션이나 아침 기록은 생성하지 않았어요."
          />
          <Button label="시연 선택으로" onPress={menu} />
        </ScrollView>
      </NightScreen>
    );
  if (actions)
    return (
      <NightReturnFlow
        actions={actions}
        onRestart={(request) => setNext({ kind: 'restart', ...request })}
        onNavigate={setNext}
        onExit={menu}
      />
    );
  return (
    <NightScreen>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20, gap: 16 }}>
        <Notice
          title="또 왔네 · 독립 미리보기"
          description="조회 mock으로 재방문 기록·빠른 선택·상태 재확인만 준비했어요. 실제 새 세션·피드·아침 누적·자동 04시 마감·앱 종료 복원은 아직 연결하지 않았어요."
        />
        {presets.map(({ label, value }) => (
          <Button
            key={value}
            label={label}
            onPress={() => setActions(createMockNightReturn(value))}
          />
        ))}
        <Button label="시작 화면으로" onPress={onExit} />
      </ScrollView>
    </NightScreen>
  );
}

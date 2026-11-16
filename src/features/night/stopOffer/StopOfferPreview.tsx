import { useEffect, useState } from 'react';
import { BackHandler, ScrollView } from 'react-native';
import { createMockStopOffer } from '../../../mocks/stopOffer';
import type { ClosingScenario } from '../../../mocks/nightClosing';
import { Button } from '../../../ui/Button';
import { NightScreen } from '../../../ui/NightScreen';
import { Notice } from '../../../ui/Notice';
import { ClosingScreen } from '../closing/ClosingScreen';
import { StopOfferScreen } from './StopOfferScreen';
type Source = NonNullable<ReturnType<typeof createMockStopOffer>>;
interface Props {
  source: Source;
  onBack: () => void;
}
export function StopOfferDemo(props: Props) {
  const [current, setCurrent] = useState({ source: props.source, version: 0 });
  if (current.source !== props.source)
    setCurrent({ source: props.source, version: current.version + 1 });
  return <Session key={current.version} {...props} />;
}
function Session({ source, onBack }: Props) {
  const [step, setStep] = useState<'offer' | 'continue' | 'closing' | 'rest'>(
    'offer',
  );
  useEffect(() => {
    if (step !== 'continue' && step !== 'rest') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [step, onBack]);
  if (step === 'offer')
    return (
      <StopOfferScreen
        sheepCount={source.input.sheepCount}
        onStop={() => setStep('closing')}
        onContinue={() => setStep('continue')}
        onBack={onBack}
      />
    );
  if (step === 'closing')
    return (
      <ClosingScreen
        input={source.input}
        actions={source.closing}
        onExit={onBack}
        onRest={() => setStep('rest')}
      />
    );
  return (
    <NightScreen>
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          gap: 16,
          flexGrow: 1,
          justifyContent: 'center',
        }}
      >
        <Notice
          title={
            step === 'continue' ? '계속 세기를 선택했어요' : '편안한 밤 보내요'
          }
          description={
            step === 'continue'
              ? '더 세고 싶을 땐 천천히 이어 가요.'
              : '오늘은 여기까지 해도 괜찮아요.'
          }
        />
        {step === 'continue' && (
          <Button label="선택 다시 보기" onPress={() => setStep('offer')} />
        )}
        <Button label="시연 선택으로" onPress={onBack} />
      </ScrollView>
    </NightScreen>
  );
}
const presets: readonly {
  label: string;
  count: number;
  scenario?: ClosingScenario;
}[] = [
  { label: '16마리 · 첫 등장', count: 16 },
  { label: '20마리 · 그만 세기', count: 20 },
  { label: '30마리 · 그만 세기', count: 30 },
  { label: '종료 응답 유실 · 재시도', count: 20, scenario: 'finish-lost' },
  { label: '따뜻한 카드 확인 실패', count: 20, scenario: 'view-retry' },
  { label: '따뜻한 카드 없음', count: 20, scenario: 'unavailable' },
];
export function StopOfferPreview({ onExit }: { onExit: () => void }) {
  const [source, setSource] = useState<Source | null>(null);
  if (source)
    return <StopOfferDemo source={source} onBack={() => setSource(null)} />;
  return (
    <NightScreen>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, flexGrow: 1 }}>
        <Notice
          title="그만 세도 되는 양 · 독립 미리보기"
          description="16마리 이상일 때 14번째 칸을 확인해요. 그만 선택은 따뜻한 카드·마무리 mock으로 이어져요. 계속 선택은 확인 화면까지만 표시해요. 실제 피드 이동·아침 기록·04시 마감은 아직 연결하지 않았어요."
        />
        {presets.map(({ label, count, scenario }) => (
          <Button
            key={label}
            label={label}
            onPress={() => setSource(createMockStopOffer(count, scenario))}
          />
        ))}
        <Button label="시작 화면으로" onPress={onExit} />
      </ScrollView>
    </NightScreen>
  );
}

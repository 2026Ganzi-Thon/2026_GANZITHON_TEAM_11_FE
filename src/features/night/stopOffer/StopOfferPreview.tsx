import { HomeNightJourney } from '../../home/HomeNightJourney';
import {
  createStopOfferJourney,
  type StopOfferJourneyPreset,
} from '../../../mocks/stopOfferJourney';
import { useEffect, useRef, useState } from 'react';
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
const journeyPresets: readonly {
  label: string;
  value: StopOfferJourneyPreset;
}[] = [
  { label: '밤부터 아침까지', value: 'success' },
  { label: '고민 없음 · 그만 세기', value: 'none' },
  { label: '느린 종료 저장', value: 'slow' },
  { label: '종료 실패·재시도', value: 'retry' },
  { label: '종료 응답 유실·복구', value: 'lost' },
  { label: '그만 세기 화면 04시 마감', value: 'expiry' },
  { label: '종료 저장 중 마감', value: 'expiry-save' },
  { label: '종료 재시도 중 마감', value: 'expiry-retry' },
];
export function StopOfferPreview({ onExit }: { onExit: () => void }) {
  const [source, setSource] = useState<Source | null>(null);
  const [journey, setJourney] = useState<Awaited<
    ReturnType<typeof createStopOfferJourney>
  > | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const start = async (preset: StopOfferJourneyPreset) => {
    if (request.current) return;
    const c = new AbortController();
    request.current = c;
    setBusy(true);
    setError(false);
    try {
      const value = await createStopOfferJourney(preset, c.signal);
      if (!c.signal.aborted) setJourney(value);
    } catch {
      if (!c.signal.aborted) setError(true);
    } finally {
      if (!c.signal.aborted) {
        request.current = null;
        setBusy(false);
      }
    }
  };
  if (journey)
    return (
      <HomeNightJourney
        source={journey}
        initialNightOpen
        onExit={() => setJourney(null)}
      />
    );
  if (source)
    return <StopOfferDemo source={source} onBack={() => setSource(null)} />;
  return (
    <NightScreen>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, flexGrow: 1 }}>
        <Notice
          title="그만 세도 되는 양 · 밤부터 아침까지"
          description="20마리 중 14번째 칸에서 시작해요. 계정·피드·아침은 메모리 mock이에요. 마감 시연은 준비 후 20초 뒤 닫혀요. 느린 종료·재시도는 약 6초 걸려요. 아래 독립 화면은 선택·마무리만 확인해요. 실제 서버·앱 종료 후 복원은 연결하지 않았어요."
        />
        {error && (
          <Notice
            error
            title="시연을 준비하지 못했어요"
            description="원하는 시연을 다시 선택해 주세요."
          />
        )}
        {journeyPresets.map(({ label, value }) => (
          <Button
            key={value}
            label={label}
            disabled={busy}
            onPress={() => void start(value)}
          />
        ))}
        {presets.map(({ label, count, scenario }) => (
          <Button
            key={label}
            label={label}
            disabled={busy}
            onPress={() => setSource(createMockStopOffer(count, scenario))}
          />
        ))}
        <Button label="시작 화면으로" disabled={busy} onPress={onExit} />
      </ScrollView>
    </NightScreen>
  );
}

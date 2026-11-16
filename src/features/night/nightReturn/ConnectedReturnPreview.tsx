import { useEffect, useState } from 'react';
import { BackHandler, ScrollView } from 'react-native';
import {
  createMockNightReturnJourney,
  type ReturnJourneyScenario,
} from '../../../mocks/nightReturnJourney';
import { HomeNightJourney } from '../../home/HomeNightJourney';
import { NightScreen } from '../../../ui/NightScreen';
import { Notice } from '../../../ui/Notice';
import { Button } from '../../../ui/Button';
export function ConnectedReturnPreview({
  scenario,
  onExit,
}: {
  scenario: ReturnJourneyScenario;
  onExit: () => void;
}) {
  const [attempt, setAttempt] = useState(0),
    [source, setSource] = useState<Awaited<
      ReturnType<typeof createMockNightReturnJourney>
    > | null>(null),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void createMockNightReturnJourney(scenario, controller.signal).then(
      (value) => {
        if (!controller.signal.aborted) setSource(value);
      },
      () => {
        if (!controller.signal.aborted) setFailed(true);
      },
    );
    return () => controller.abort();
  }, [scenario, attempt]);
  useEffect(() => {
    if (source) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      onExit();
      return true;
    });
    return () => listener.remove();
  }, [source, onExit]);
  if (source)
    return (
      <HomeNightJourney source={source} initialNightOpen onExit={onExit} />
    );
  return (
    <NightScreen>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          padding: 20,
          gap: 20,
          justifyContent: 'center',
        }}
      >
        <Notice
          title={
            failed
              ? '시연을 준비하지 못했어요'
              : '같은 밤의 첫 세션을 준비하고 있어요'
          }
        />
        {failed && (
          <Button
            label="다시 준비"
            onPress={() => {
              setFailed(false);
              setAttempt((value) => value + 1);
            }}
          />
        )}
        <Button label="시연 선택으로" onPress={onExit} />
      </ScrollView>
    </NightScreen>
  );
}

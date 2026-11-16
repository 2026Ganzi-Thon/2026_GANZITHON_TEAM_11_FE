import { useState } from 'react';
import { HomeFlow } from './HomeFlow';
import { NightMorningFlow } from '../demo/NightMorningFlow';
import type { createMockHomeJourney } from '../../mocks/homeJourney';
export type HomeNightJourneySource = ReturnType<typeof createMockHomeJourney>;
export function HomeNightJourney(props: {
  source: HomeNightJourneySource;
  onExit: () => void;
}) {
  const [current, setCurrent] = useState({ source: props.source, version: 0 });
  if (current.source !== props.source)
    setCurrent({ source: props.source, version: current.version + 1 });
  return <Session key={current.version} {...props} />;
}
function Session({
  source,
  onExit,
}: {
  source: HomeNightJourneySource;
  onExit: () => void;
}) {
  const [nightOpen, setNightOpen] = useState(false);
  return nightOpen ? (
    <NightMorningFlow
      demo={source.night}
      navigation={source.navigation}
      entryMode={
        source.night.getRecord().night ? 'existing-night' : 'first-entry'
      }
      onExit={onExit}
      onHome={() => setNightOpen(false)}
      onMorning={() => {
        source.advanceMorning();
        setNightOpen(false);
      }}
    />
  ) : (
    <HomeFlow
      source={source.home}
      onExit={onExit}
      onNight={() => setNightOpen(true)}
    />
  );
}

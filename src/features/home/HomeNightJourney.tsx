import { useState } from 'react';
import { HomeFlow } from './HomeFlow';
import { NightReturnJourney } from '../night/nightReturn/NightReturnJourney';
import { NightExpiryBoundary } from '../night/expiry/NightExpiryBoundary';
import type { createMockHomeJourney } from '../../mocks/homeJourney';
export type HomeNightJourneySource = ReturnType<
  typeof createMockHomeJourney
> & { enterNight?: () => boolean | void };
interface Props {
  source: HomeNightJourneySource;
  onExit: () => void;
  initialNightOpen?: boolean;
}
export function HomeNightJourney(props: Props) {
  const [current, setCurrent] = useState({ source: props.source, version: 0 });
  if (current.source !== props.source)
    setCurrent({ source: props.source, version: current.version + 1 });
  return <Session key={current.version} {...props} />;
}
function Session({ source, onExit, initialNightOpen = false }: Props) {
  const [nightOpen, setNightOpen] = useState(initialNightOpen);
  return nightOpen ? (
    <NightExpiryBoundary
      actions={source.night.expiry}
      onMorning={() => setNightOpen(false)}
      onHome={() => setNightOpen(false)}
    >
      {(blocked) => (
        <NightReturnJourney
          demo={source.night}
          navigation={source.navigation}
          blocked={blocked}
          onExit={onExit}
          onHome={() => setNightOpen(false)}
          onMorning={() => {
            source.advanceMorning();
            setNightOpen(false);
          }}
        />
      )}
    </NightExpiryBoundary>
  ) : (
    <HomeFlow
      source={source.home}
      onExit={onExit}
      onNight={() => {
        if (source.enterNight?.() === false) return;
        setNightOpen(true);
      }}
    />
  );
}

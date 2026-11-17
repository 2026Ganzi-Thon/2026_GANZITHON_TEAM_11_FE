import { useSyncExternalStore } from 'react';
import { SignupOnboardingFlow } from './SignupOnboardingFlow';
import { HomeNightJourney } from '../home/HomeNightJourney';
import type { createMockSignupJourney } from '../../mocks/signupJourney';
export type SignupJourneySource = ReturnType<typeof createMockSignupJourney>;
export function SignupJourneyFlow({
  source,
  onExit,
}: {
  source: SignupJourneySource;
  onExit: () => void;
}) {
  const version = useSyncExternalStore(
    source.subscribe,
    source.getVersion,
    source.getVersion,
  );
  return (
    <SignupOnboardingFlow
      key={version}
      source={source}
      onExit={onExit}
      onNight={() => {}}
      renderHome={({ onExit }) => (
        <HomeNightJourney source={source.getJourney()!} onExit={onExit} />
      )}
    />
  );
}

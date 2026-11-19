import type { ComponentProps, ReactNode } from 'react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { BackHandler } from 'react-native';
import { SignupFlow } from './SignupFlow';
import { SignupReminderScreen } from './SignupReminderScreen';
import { DaySignupIntro } from './DaySignupIntro';
import type { SignupOnboarding } from './onboarding';
import type { SignupActions } from './types';
import { HomeFlow } from '../home/HomeFlow';
import type { HomeSnapshot } from '../home/model';
export interface SignupOnboardingSource {
  initialLoginEmail?: string;
  onLoginComplete?: () => void;
  signup: SignupActions;
  onboarding: SignupOnboarding;
}
interface SignupOnboardingProps {
  source: SignupOnboardingSource;
  onExit: () => void;
  onNight: (snapshot: HomeSnapshot) => void;
  renderHome?: (props: ComponentProps<typeof HomeFlow>) => ReactNode;
}
export function SignupOnboardingFlow(props: SignupOnboardingProps) {
  const [current, setCurrent] = useState({ source: props.source, version: 0 });
  if (current.source !== props.source)
    setCurrent({ source: props.source, version: current.version + 1 });
  return <Session key={current.version} {...props} />;
}
function Session({
  source,
  onExit,
  onNight,
  renderHome,
}: SignupOnboardingProps) {
  const c = source.onboarding;
  const state = useSyncExternalStore(c.subscribe, c.getSnapshot, c.getSnapshot);
  useEffect(() => {
    c.start();
    return c.stop;
  }, [c]);
  useEffect(() => {
    if (state.stage === 'signup' || state.stage === 'home') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (state.busy) return true;
      if (state.stage === 'time') c.back();
      else {
        if (state.stage === 'intro') c.acknowledge();
        onExit();
      }
      return true;
    });
    return () => sub.remove();
  }, [state.stage, state.busy, c, onExit]);
  if (state.stage === 'signup')
    return (
      <SignupFlow
        initialLoginEmail={source.initialLoginEmail}
        actions={source.signup}
        onExit={onExit}
        onComplete={c.begin}
        onLoginComplete={source.onLoginComplete}
      />
    );
  if (state.stage === 'home' && state.home) {
    const props = { source: state.home, onExit, onNight };
    return renderHome ? renderHome(props) : <HomeFlow {...props} />;
  }
  if (state.stage === 'intro') return <DaySignupIntro c={c} />;
  return <SignupReminderScreen c={c} />;
}

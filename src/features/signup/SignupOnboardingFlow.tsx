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
  signup: SignupActions;
  onboarding: SignupOnboarding;
}
export function SignupOnboardingFlow(props: {
  source: SignupOnboardingSource;
  onExit: () => void;
  onNight: (snapshot: HomeSnapshot) => void;
}) {
  const [current, setCurrent] = useState({ source: props.source, version: 0 });
  if (current.source !== props.source)
    setCurrent({ source: props.source, version: current.version + 1 });
  return <Session key={current.version} {...props} />;
}
function Session({
  source,
  onExit,
  onNight,
}: {
  source: SignupOnboardingSource;
  onExit: () => void;
  onNight: (snapshot: HomeSnapshot) => void;
}) {
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
        actions={source.signup}
        onExit={onExit}
        onComplete={c.begin}
      />
    );
  if (state.stage === 'home' && state.home)
    return <HomeFlow source={state.home} onExit={onExit} onNight={onNight} />;
  if (state.stage === 'intro') return <DaySignupIntro c={c} />;
  return <SignupReminderScreen c={c} />;
}

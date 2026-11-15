import { useState, type ReactNode } from 'react';
import type { HomeClockActions, HomeSnapshot } from './model';
import { HomeNightButton } from './HomeNightButton';
import { useHomeContext, type HomeContext } from './useHomeContext';
type Props = {
  actions: HomeClockActions;
  onNight: (snapshot: HomeSnapshot) => void;
  children?: (flow: HomeContext) => ReactNode;
};
export function HomeTime(props: Props) {
  const [source, setSource] = useState({ actions: props.actions, version: 0 });
  if (source.actions !== props.actions)
    setSource({ actions: props.actions, version: source.version + 1 });
  return <ClockSession key={source.version} {...props} />;
}
function ClockSession({ actions, onNight, children }: Props) {
  const flow = useHomeContext(actions, onNight);
  return children ? children(flow) : <HomeNightButton flow={flow} />;
}

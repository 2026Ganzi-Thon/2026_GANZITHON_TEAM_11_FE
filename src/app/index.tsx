import { Redirect, router, usePathname } from 'expo-router';
import { BackHandler } from 'react-native';
import { canUseMock } from '../config/runtime';
import { AppEntryFlow } from '../features/entry/AppEntryFlow';
import { getMockAppSession } from '../mocks/appSession';
export default function StartScreen() {
  return canUseMock() ? <MockEntry /> : <Redirect href="/live" />;
}
function MockEntry() {
  const path = usePathname();
  // Unmount inactive listeners and requests while a preview route has focus.
  if (path !== '/') return null;
  return (
    <AppEntryFlow
      loadSource={getMockAppSession}
      onExit={() => BackHandler.exitApp()}
      onTools={() => router.push('/dev')}
      onLive={() => router.push('/live')}
    />
  );
}

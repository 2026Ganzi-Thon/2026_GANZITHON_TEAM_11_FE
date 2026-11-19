import { router, usePathname } from 'expo-router';
import { BackHandler, Text, StyleSheet } from 'react-native';
import { canUseMock } from '../config/runtime';
import { AppEntryFlow } from '../features/entry/AppEntryFlow';
import { getMockAppSession } from '../mocks/appSession';
import { NightScreen } from '../ui/NightScreen';
import { theme } from '../ui/theme';
export default function StartScreen() {
  return canUseMock() ? (
    <MockEntry />
  ) : (
    <NightScreen>
      <Text style={s.title}>양 세는 밤</Text>
      <Text style={s.body}>서비스 연결을 준비하고 있어요.</Text>
    </NightScreen>
  );
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
    />
  );
}
const s = StyleSheet.create({
  title: {
    fontFamily: theme.font,
    color: theme.color.text,
    fontSize: 28,
    lineHeight: 40,
    textAlign: 'center',
    marginTop: 80,
  },
  body: {
    fontFamily: theme.font,
    color: theme.color.muted,
    fontSize: 16,
    lineHeight: 25,
    textAlign: 'center',
    padding: 24,
  },
});

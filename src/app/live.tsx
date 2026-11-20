import { BackHandler } from 'react-native';
import { router } from 'expo-router';
import { LiveApp } from '../features/live/LiveApp';
import { canUseMock } from '../config/runtime';
export default function LiveRoute() {
  return (
    <LiveApp
      onExit={() => {
        if (canUseMock()) router.replace('/');
        else BackHandler.exitApp();
      }}
    />
  );
}

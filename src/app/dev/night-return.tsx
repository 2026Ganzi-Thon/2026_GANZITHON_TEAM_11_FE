import { Redirect, router } from 'expo-router';
import { canUseMock } from '../../config/runtime';
import { NightReturnPreview } from '../../features/night/nightReturn/NightReturnPreview';
export default function NightReturnRoute() {
  if (!canUseMock()) return <Redirect href="/" />;
  return (
    <NightReturnPreview
      onExit={() => (router.canGoBack() ? router.back() : router.replace('/'))}
    />
  );
}

import { Redirect, router } from 'expo-router';
import { canUseMock } from '../../config/runtime';
import { StopOfferPreview } from '../../features/night/stopOffer/StopOfferPreview';
export default function StopOfferRoute() {
  if (!canUseMock()) return <Redirect href="/" />;
  return (
    <StopOfferPreview
      onExit={() => (router.canGoBack() ? router.back() : router.replace('/'))}
    />
  );
}

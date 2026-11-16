import { afterEach, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import Constants from 'expo-constants';
import Route from '../../../app/dev/night-return';
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: { appVariant: 'preview' },
      android: { package: 'com.ganzithon.yangsebam.preview' },
    },
  },
}));
jest.mock('expo-router', () => ({
  router: { canGoBack: () => false, replace: jest.fn(), back: jest.fn() },
  Redirect: () => {
    const { Text } =
      jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>blocked</Text>;
  },
}));
const original = __DEV__;
afterEach(() => {
  Object.defineProperty(globalThis, '__DEV__', {
    value: original,
    configurable: true,
  });
  Constants.expoConfig!.extra = { appVariant: 'preview' };
  Constants.expoConfig!.android!.package = 'com.ganzithon.yangsebam.preview';
});
it('opens a standalone N-09 gallery in the preview release', async () => {
  Object.defineProperty(globalThis, '__DEV__', {
    value: false,
    configurable: true,
  });
  await render(<Route />);
  expect(screen.getByRole('button', { name: '다 센 밤 재방문' })).toBeTruthy();
  expect(screen.queryByText('blocked')).toBeNull();
});
it.each(['production', 'wrong-package'] as const)(
  'blocks the standalone N-09 route in %s',
  async (mode) => {
    Object.defineProperty(globalThis, '__DEV__', {
      value: false,
      configurable: true,
    });
    if (mode === 'production')
      Constants.expoConfig!.extra = { appVariant: 'production' };
    else Constants.expoConfig!.android!.package = 'com.ganzithon.yangsebam';
    await render(<Route />);
    expect(screen.getByText('blocked')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: '다 센 밤 재방문' }),
    ).toBeNull();
  },
);

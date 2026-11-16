import { afterEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Constants from 'expo-constants';
import Route from '../../../app/dev/stop-offer';
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: { appVariant: 'preview' },
      android: { package: 'com.ganzithon.yangsebam.preview' },
    },
  },
}));
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    canGoBack: () => false,
    replace: (path: string) => mockReplace(path),
    back: jest.fn(),
  },
  Redirect: () => {
    const { Text } =
      jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>blocked</Text>;
  },
}));
const originalDev = __DEV__;
afterEach(() => {
  Object.defineProperty(globalThis, '__DEV__', {
    value: originalDev,
    configurable: true,
  });
  Constants.expoConfig!.extra = { appVariant: 'preview' };
  Constants.expoConfig!.android!.package = 'com.ganzithon.yangsebam.preview';
  mockReplace.mockClear();
});
it('allows the standalone scene in a preview release and exits to the start', async () => {
  Object.defineProperty(globalThis, '__DEV__', {
    value: false,
    configurable: true,
  });
  await render(<Route />);
  await fireEvent.press(screen.getByRole('button', { name: '시작 화면으로' }));
  expect(mockReplace).toHaveBeenCalledWith('/');
  expect(screen.queryByText('blocked')).toBeNull();
});
it.each(['production', 'wrong-package'] as const)(
  'blocks the standalone scene for %s',
  async (preset) => {
    Object.defineProperty(globalThis, '__DEV__', {
      value: false,
      configurable: true,
    });
    if (preset === 'production')
      Constants.expoConfig!.extra = { appVariant: 'production' };
    else Constants.expoConfig!.android!.package = 'com.ganzithon.yangsebam';
    await render(<Route />);
    expect(screen.getByText('blocked')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: '20마리 · 그만 세기' }),
    ).toBeNull();
  },
);

import { afterEach, expect, it, jest } from '@jest/globals';
import { act, render, screen, fireEvent } from '@testing-library/react-native';
import Constants from 'expo-constants';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import Start from '../../app/index';
import { AndroidReminderRuntime } from '../../notifications/AndroidReminderRuntime';
import Route0 from '../../app/dev/android-reminder';
import Route1 from '../../app/dev/birth-date-flow';
import Route2 from '../../app/dev/birth-date';
import Route3 from '../../app/dev/card-support';
import Route4 from '../../app/dev/first-night-home';
import Route5 from '../../app/dev/fluff';
import Route6 from '../../app/dev/fortune';
import Route7 from '../../app/dev/login';
import Route8 from '../../app/dev/morning-reflection';
import Route9 from '../../app/dev/morning';
import Route10 from '../../app/dev/my-cards';
import Route11 from '../../app/dev/night-closing';
import Route12 from '../../app/dev/night-entry';
import Route13 from '../../app/dev/night-feed';
import Route14 from '../../app/dev/night-morning';
import Route15 from '../../app/dev/night-reentry';
import Route16 from '../../app/dev/received-yarn';
import Route17 from '../../app/dev/reminder';
import Route18 from '../../app/dev/saved-songs';
import Route19 from '../../app/dev/settings';
import Route20 from '../../app/dev/sheep-detail';
import Route21 from '../../app/dev/signup-home';
import Route22 from '../../app/dev/signup';
import Route23 from '../../app/dev/song-card';
import Route24 from '../../app/dev/text-card';
import Route25 from '../../app/dev/worry-deletion';
import Route26 from '../../app/dev/yarn';
import Route27 from '../../app/dev/home-night-morning';
import Route28 from '../../app/dev/night-expiry';
import { getNativeReminderSession } from '../../notifications/nativeRuntime';
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: { appVariant: 'preview' },
      android: { package: 'com.ganzithon.yangsebam.preview' },
    },
  },
}));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    push: (path: string) => mockPush(path),
    canGoBack: () => false,
    replace: jest.fn(),
  },
  Redirect: () => {
    const { Text } =
      jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>blocked</Text>;
  },
}));
const mockRuntimeStart = jest.fn(() => () => {});
const mockSnapshot = {
  phase: 'ready',
  state: { state: 'off' },
  permission: null,
};
jest.mock('../../notifications/nativeRuntime', () => ({
  startNativeReminderRuntime: () => mockRuntimeStart(),
  getNativeReminderSession: jest.fn(() => ({
    device: {
      getSnapshot: () => mockSnapshot,
      subscribe: () => () => {},
      refresh: async () => {},
    },
    source: {},
    reset: async () => {},
    sendTest: async () => {},
  })),
}));
const original = __DEV__;
afterEach(() => {
  Object.defineProperty(globalThis, '__DEV__', {
    value: original,
    configurable: true,
  });
  mockPush.mockClear();
  mockRuntimeStart.mockClear();
  jest.mocked(getNativeReminderSession).mockClear();
  jest.useRealTimers();
  Constants.expoConfig!.extra = { appVariant: 'preview' };
});
const routes = [
  ['android-reminder', Route0],
  ['birth-date-flow', Route1],
  ['birth-date', Route2],
  ['card-support', Route3],
  ['first-night-home', Route4],
  ['fluff', Route5],
  ['fortune', Route6],
  ['login', Route7],
  ['morning-reflection', Route8],
  ['morning', Route9],
  ['my-cards', Route10],
  ['night-closing', Route11],
  ['night-entry', Route12],
  ['night-feed', Route13],
  ['night-morning', Route14],
  ['night-reentry', Route15],
  ['received-yarn', Route16],
  ['reminder', Route17],
  ['saved-songs', Route18],
  ['settings', Route19],
  ['sheep-detail', Route20],
  ['signup-home', Route21],
  ['signup', Route22],
  ['song-card', Route23],
  ['text-card', Route24],
  ['worry-deletion', Route25],
  ['yarn', Route26],
  ['home-night-morning', Route27],
  ['night-expiry', Route28],
] as const;
it.each(routes)(
  'opens %s in a preview release without a development server',
  async (_path, Route) => {
    Object.defineProperty(globalThis, '__DEV__', {
      value: false,
      configurable: true,
    });
    await render(<Route />);
    expect(screen.queryByText('blocked')).toBeNull();
  },
);
it.each(routes)(
  'blocks %s when the same release has no preview opt-in',
  async (_path, Route) => {
    Object.defineProperty(globalThis, '__DEV__', {
      value: false,
      configurable: true,
    });
    Constants.expoConfig!.extra = { appVariant: 'production' };
    await render(<Route />);
    expect(screen.getByText('blocked')).toBeTruthy();
  },
);
it('shows the mock limits and representative entry points in the preview release', async () => {
  Object.defineProperty(globalThis, '__DEV__', {
    value: false,
    configurable: true,
  });
  await render(<Start />);
  expect(screen.getByText('테스트 체험판')).toBeTruthy();
  expect(screen.getByText(/재실행하면 기록이 초기화/)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: '밤→아침 시연' }));
  expect(mockPush).toHaveBeenCalledWith('/dev/night-morning');
  await fireEvent.press(
    screen.getByRole('button', { name: '가입 → 첫 홈 → 밤·아침' }),
  );
  expect(mockPush).toHaveBeenCalledWith('/dev/signup-home');
  await fireEvent.press(
    screen.getByRole('button', { name: '첫 홈 → 밤 → 아침 통합' }),
  );
  expect(mockPush).toHaveBeenCalledWith('/dev/home-night-morning');
});
it('starts and cleans up device reminder reconciliation in preview releases', async () => {
  Object.defineProperty(globalThis, '__DEV__', {
    value: false,
    configurable: true,
  });
  const view = await render(<AndroidReminderRuntime />);
  expect(mockRuntimeStart).toHaveBeenCalledTimes(1);
  await view.unmount();
});

it('opens the shared home from its preview-release route and initializes its native session', async () => {
  jest.useFakeTimers();
  Object.defineProperty(globalThis, '__DEV__', {
    value: false,
    configurable: true,
  });
  await render(
    <SafeAreaInsetsContext.Provider
      value={{ top: 28, bottom: 24, left: 0, right: 0 }}
    >
      <Route27 />
    </SafeAreaInsetsContext.Provider>,
  );
  expect(getNativeReminderSession).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole('button', { name: '첫 홈부터 시작' }));
  await act(async () => {
    await jest.advanceTimersByTimeAsync(2400);
  });
  expect(screen.getByText('아직 센 양이 없어요')).toBeTruthy();
});
it('blocks direct production entry without initializing its native session', async () => {
  Object.defineProperty(globalThis, '__DEV__', {
    value: false,
    configurable: true,
  });
  Constants.expoConfig!.extra = { appVariant: 'production' };
  await render(<Route27 />);
  expect(screen.getByText('blocked')).toBeTruthy();
  expect(getNativeReminderSession).not.toHaveBeenCalled();
});

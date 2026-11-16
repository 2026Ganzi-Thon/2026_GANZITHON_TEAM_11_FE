import { afterEach, expect, it, jest } from '@jest/globals';
import { act } from '@testing-library/react-native';
import { renderRouter, screen, fireEvent } from 'expo-router/testing-library';
import { BackHandler, Text } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import Preview from '../../app/dev/signup-home';
import * as sources from '../../mocks/signupJourney';
import { getNativeReminderSession } from '../../notifications/nativeRuntime';
jest.mock('../../notifications/nativeRuntime', () => ({
  getNativeReminderSession: jest.fn(() => {
    const account = jest
      .requireActual<typeof import('../../mocks/reminder')>(
        '../../mocks/reminder',
      )
      .createMockReminder();
    const native = jest
      .requireActual<
        typeof import('../../notifications/__tests__/storedDevice')
      >('../../notifications/__tests__/storedDevice')
      .storedDevice();
    const service = jest
      .requireActual<typeof import('../../notifications/service')>(
        '../../notifications/service',
      )
      .createDeviceReminder(native.port);
    const connection = jest
      .requireActual<typeof import('../../notifications/connection')>(
        '../../notifications/connection',
      )
      .createReminderConnection(account, service);
    return { reminder: { ...account, ...connection }, reset: async () => {} };
  }),
}));
const original = __DEV__;
afterEach(() => {
  Object.defineProperty(globalThis, '__DEV__', {
    value: original,
    configurable: true,
  });
  jest.useRealTimers();
  jest.restoreAllMocks();
  jest.clearAllMocks();
});
const route = () =>
  renderRouter(
    {
      index: () => <Text>시작</Text>,
      'dev/signup-home': () => (
        <SafeAreaInsetsContext.Provider
          value={{ top: 28, bottom: 24, left: 0, right: 0 }}
        >
          <Preview />
        </SafeAreaInsetsContext.Provider>
      ),
    },
    { initialUrl: '/dev/signup-home' },
  );
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
const tick = async () => {
  for (let i = 0; i < 2; i++)
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1500);
    });
};
it('blocks production signup integration before native initialization', async () => {
  Object.defineProperty(globalThis, '__DEV__', {
    value: false,
    configurable: true,
  });
  expect((await route()).getPathname()).toBe('/');
  expect(getNativeReminderSession).not.toHaveBeenCalled();
});
it('reopens the registered first home at 21:00 without creating another account or night source', async () => {
  jest.useFakeTimers();
  const factory = jest.spyOn(sources, 'createMockSignupJourney');
  let back: (() => boolean | null | undefined) | undefined;
  jest
    .spyOn(BackHandler, 'addEventListener')
    .mockImplementation((_event, callback) => {
      back = () => callback({} as Parameters<typeof callback>[0]);
      return { remove: () => {} };
    });
  await route();
  await press('낮 가입부터 시작');
  expect(factory).toHaveBeenCalledTimes(1);
  const source = factory.mock.results[0].value as ReturnType<
    typeof sources.createMockSignupJourney
  >;
  await act(async () => {
    source.onboarding.begin(
      { id: 'route-account', email: 'route@example.com' },
      { birth_date: '2001-03-12', edits_remaining: 1, zodiac: 'pisces' },
    );
  });
  await press('나중에 할게요');
  await tick();
  await press('밤에 만나요');
  await tick();
  await tick();
  const journey = source.getJourney();
  expect(
    screen.getByRole('button', { name: '밤 9시에 열려요' }),
  ).toBeDisabled();
  await act(async () => {
    back?.();
  });
  await press('같은 계정으로 밤 9시로 이동');
  await tick();
  await tick();
  expect(factory).toHaveBeenCalledTimes(1);
  expect(source.getJourney()).toBe(journey);
  await press('오늘 밤 양 세러 가기');
  await tick();
  await fireEvent.press(screen.getByRole('radio', { name: '고민 없음' }));
  await press('다음');
  await tick();
  expect(journey!.night.getRecord().night).not.toBeNull();
  expect(screen.getByRole('button', { name: '양 세기 시작' })).toBeTruthy();
});

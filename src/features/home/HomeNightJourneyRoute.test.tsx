import { afterEach, expect, it, jest } from '@jest/globals';
import { act } from '@testing-library/react-native';
import { renderRouter, screen, fireEvent } from 'expo-router/testing-library';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { Text } from 'react-native';
import Preview from '../../app/dev/home-night-morning';
import { getNativeReminderSession } from '../../notifications/nativeRuntime';
jest.mock('../../notifications/nativeRuntime', () => ({
  getNativeReminderSession: jest.fn(() => ({
    reminder: jest
      .requireActual<typeof import('../../mocks/reminder')>(
        '../../mocks/reminder',
      )
      .createMockReminder(),
  })),
}));
const original = __DEV__;
afterEach(() => {
  Object.defineProperty(globalThis, '__DEV__', {
    value: original,
    configurable: true,
  });
  jest.useRealTimers();
  jest.clearAllMocks();
});
const route = () =>
  renderRouter(
    {
      index: () => <Text>시작</Text>,
      'dev/home-night-morning': () => (
        <SafeAreaInsetsContext.Provider
          value={{ top: 28, bottom: 24, left: 0, right: 0 }}
        >
          <Preview />
        </SafeAreaInsetsContext.Provider>
      ),
    },
    { initialUrl: '/dev/home-night-morning' },
  );
it('blocks the new standalone integration route without initializing native work in production', async () => {
  Object.defineProperty(globalThis, '__DEV__', {
    value: false,
    configurable: true,
  });
  const view = await route();
  expect(view.getPathname()).toBe('/');
  expect(getNativeReminderSession).not.toHaveBeenCalled();
});
it('opens the first home in the development integration route', async () => {
  jest.useFakeTimers();
  await route();
  await fireEvent.press(screen.getByRole('button', { name: '첫 홈부터 시작' }));
  for (let i = 0; i < 2; i++)
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });
  expect(screen.getByText('아직 센 양이 없어요')).toBeTruthy();
  expect(
    screen.getByRole('button', { name: '오늘 밤 양 세러 가기' }),
  ).not.toBeDisabled();
});

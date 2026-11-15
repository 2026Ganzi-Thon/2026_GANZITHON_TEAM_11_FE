import { afterEach, expect, it, jest } from '@jest/globals';
import { act } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { renderRouter, screen, fireEvent } from 'expo-router/testing-library';
import HomePreview from '../../app/dev/first-night-home';
const original = __DEV__;
afterEach(() => {
  Object.defineProperty(globalThis, '__DEV__', {
    value: original,
    configurable: true,
  });
  jest.useRealTimers();
});
const route = () =>
  renderRouter(
    {
      index: () => <Text>시작 화면</Text>,
      'dev/first-night-home': () => (
        <SafeAreaInsetsContext.Provider
          value={{ top: 28, bottom: 24, left: 0, right: 0 }}
        >
          <HomePreview />
        </SafeAreaInsetsContext.Provider>
      ),
    },
    { initialUrl: '/dev/first-night-home' },
  );
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
const tick = () =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(700);
  });
it('blocks production deep links', async () => {
  Object.defineProperty(globalThis, '__DEV__', {
    value: false,
    configurable: true,
  });
  expect((await route()).getPathname()).toBe('/');
});
it('connects first home, fortune, settings, cards and night entry with a return to home', async () => {
  jest.useFakeTimers();
  await route();
  await press('첫 밤 전 · 밤');
  await tick();
  expect(screen.getByText('아직 센 양이 없어요')).toBeTruthy();
  await press('오늘의 운세 보기');
  expect(screen.getByText('오늘의 양 운세')).toBeTruthy();
  await press('오늘의 운세 닫기');
  await press('설정 열기');
  await tick();
  expect(screen.getByText('0밤째 양을 세는 중')).toBeTruthy();
  await press('아침 홈으로 돌아가기');
  await tick();
  await press('내 카드 열기');
  await tick();
  expect(screen.getByText('아직 쓴 카드가 없어요')).toBeTruthy();
  await press('홈으로 돌아가기');
  await tick();
  await press('오늘 밤 양 세러 가기');
  await tick();
  expect(screen.getByLabelText('오늘의 고민')).toBeTruthy();
  await press('뒤로');
  await tick();
  expect(screen.getByText('아직 센 양이 없어요')).toBeTruthy();
});

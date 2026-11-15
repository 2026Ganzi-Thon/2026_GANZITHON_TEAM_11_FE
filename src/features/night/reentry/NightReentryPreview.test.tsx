import { afterEach, expect, it, jest } from '@jest/globals';
import { act } from '@testing-library/react-native';
import { AccessibilityInfo, Text } from 'react-native';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import NightReentryPreview from '../../../app/dev/night-reentry';
const originalDev = __DEV__;
afterEach(() => {
  Object.defineProperty(globalThis, '__DEV__', {
    value: originalDev,
    configurable: true,
  });
  jest.useRealTimers();
  jest.restoreAllMocks();
});
it('blocks the explicit mock reentry route in a production build', async () => {
  Object.defineProperty(globalThis, '__DEV__', {
    value: false,
    configurable: true,
  });
  const result = await renderRouter(
    {
      index: () => <Text>시작 화면</Text>,
      'dev/night-reentry': NightReentryPreview,
    },
    { initialUrl: '/dev/night-reentry' },
  );
  expect(result.getPathname()).toBe('/');
});
it('requires an explicit scenario and discards its memory records when the preview ends', async () => {
  jest.useFakeTimers();
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
  await renderRouter(
    {
      index: () => <Text>시작 화면</Text>,
      'dev/night-reentry': NightReentryPreview,
    },
    { initialUrl: '/dev/night-reentry' },
  );
  const press = (name: string) =>
    fireEvent.press(screen.getByRole('button', { name }));
  const settle = async () => {
    for (let i = 0; i < 5; i++)
      await act(async () => {
        await jest.advanceTimersByTimeAsync(800);
      });
  };
  await press('기존 세션 · 2번째 양');
  await settle();
  expect(screen.getByText('2 / 6')).toBeTruthy();
  await press('이전 양');
  await press('미리보기 나가기');
  await press('시연 끝내기');
  await press('기존 세션 · 2번째 양');
  await settle();
  expect(screen.getByText('2 / 6')).toBeTruthy();
});

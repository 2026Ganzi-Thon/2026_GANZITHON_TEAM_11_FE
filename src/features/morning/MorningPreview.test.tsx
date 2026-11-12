import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';
import MorningPreview from '../../app/dev/morning';
const originalDev = __DEV__;
afterEach(() => {
  jest.useRealTimers();
  Object.defineProperty(globalThis, '__DEV__', {
    value: originalDev,
    configurable: true,
  });
});
it('redirects the morning route in release mode', async () => {
  Object.defineProperty(globalThis, '__DEV__', {
    value: false,
    configurable: true,
  });
  const result = await renderRouter(
    { index: () => <Text>시작</Text>, 'dev/morning': MorningPreview },
    { initialUrl: '/dev/morning' },
  );
  expect(result.getPathname()).toBe('/');
});
it('replays a lost adoption response through the gallery and resets on reentry', async () => {
  jest.useFakeTimers();
  Object.defineProperty(globalThis, '__DEV__', {
    value: true,
    configurable: true,
  });
  await renderRouter(
    { index: () => <Text>시작</Text>, 'dev/morning': MorningPreview },
    { initialUrl: '/dev/morning' },
  );
  const press = (name: string) =>
    fireEvent.press(screen.getByRole('button', { name }));
  const advance = () =>
    act(async () => {
      await jest.advanceTimersByTimeAsync(1200);
    });
  await press('데려오기 응답 유실');
  await advance();
  await press('이 양 데려오기');
  await advance();
  expect(screen.getByRole('radio', { name: '4번째 양' })).toBeChecked();
  expect(screen.queryByText('나의 양떼')).toBeNull();
  await press('이 양 데려오기');
  await advance();
  expect(screen.getAllByLabelText('2026-11-10의 양 · 새로 온 양')).toHaveLength(
    1,
  );
  await press('미리보기 나가기');
  await press('데려오기 응답 유실');
  await advance();
  expect(screen.queryByText('나의 양떼')).toBeNull();
  expect(screen.getByRole('radio', { name: '4번째 양' })).toBeChecked();
});

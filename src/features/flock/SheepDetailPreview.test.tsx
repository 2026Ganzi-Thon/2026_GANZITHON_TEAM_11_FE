import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { MorningScreen } from '../morning/MorningScreen';
import { createMockMorning } from '../../mocks/morning';
import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';
import SheepDetailPreview from '../../app/dev/sheep-detail';
const originalDev = __DEV__;
const press = (label: string) =>
  fireEvent.press(screen.getByRole('button', { name: label }));
const advance = () =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(1800);
  });
afterEach(() => {
  jest.useRealTimers();
  Object.defineProperty(globalThis, '__DEV__', {
    value: originalDev,
    configurable: true,
  });
});
it('opens the adopted sheep and preserves home state on header and Android modal back', async () => {
  jest.useFakeTimers();
  const api = createMockMorning();
  const morning = jest.spyOn(api, 'loadMorning');
  const flock = jest.spyOn(api, 'loadFlock');
  const adopt = jest.spyOn(api, 'adopt');
  const load = jest.fn(api.loadSheep);
  const exit = jest.fn();
  await render(<MorningScreen actions={api} loadDetail={load} onExit={exit} />);
  await advance();
  await press('이 양 데려오기');
  await advance();
  const title = '2026-11-10의 양 · 새로 온 양';
  await press(title);
  await advance();
  expect(load).toHaveBeenLastCalledWith(
    'preview-adopted',
    expect.any(AbortSignal),
  );
  expect(screen.getByText('잠깐의 쉼 (예시)')).toBeTruthy();
  await press('양떼로 돌아가기');
  expect(screen.getByRole('button', { name: title })).toBeTruthy();
  expect(screen.getByText('한 마리가 양떼에 도착했어요.')).toBeTruthy();
  await press('2026-11-09의 양');
  await advance();
  expect(screen.queryByText('잠깐의 쉼 (예시)')).toBeNull();
  expect(load).toHaveBeenLastCalledWith(
    'preview-sheep-0',
    expect.any(AbortSignal),
  );
  await fireEvent(screen.getByTestId('sheep-detail-modal'), 'requestClose');
  expect(screen.getByText('나의 양떼')).toBeTruthy();
  expect(exit).not.toHaveBeenCalled();
  expect(morning).toHaveBeenCalledTimes(1);
  expect(flock).toHaveBeenCalledTimes(1);
  expect(adopt).toHaveBeenCalledTimes(1);
});
it('cancels a pending detail read when Android closes the modal', async () => {
  jest.useFakeTimers();
  const api = createMockMorning('existing');
  const load = jest.fn(api.loadSheep);
  await render(
    <MorningScreen actions={api} loadDetail={load} onExit={() => {}} />,
  );
  await advance();
  await press('2026-11-10의 양');
  await fireEvent(screen.getByTestId('sheep-detail-modal'), 'requestClose');
  expect(load.mock.calls[0][1].aborted).toBe(true);
  await advance();
  expect(screen.getByText('나의 양떼')).toBeTruthy();
  expect(screen.queryByText('잠깐의 쉼 (예시)')).toBeNull();
});
it('blocks the detail gallery in release builds', async () => {
  Object.defineProperty(globalThis, '__DEV__', {
    value: false,
    configurable: true,
  });
  const result = await renderRouter(
    { index: () => <Text>시작</Text>, 'dev/sheep-detail': SheepDetailPreview },
    { initialUrl: '/dev/sheep-detail' },
  );
  expect(result.getPathname()).toBe('/');
});
it('opens the selected missing-record gallery scenario and returns to its flock', async () => {
  jest.useFakeTimers();
  Object.defineProperty(globalThis, '__DEV__', {
    value: true,
    configurable: true,
  });
  await renderRouter(
    { index: () => <Text>시작</Text>, 'dev/sheep-detail': SheepDetailPreview },
    { initialUrl: '/dev/sheep-detail' },
  );
  await press('찾을 수 없는 양');
  await advance();
  await press('2026-11-10의 양');
  await advance();
  expect(screen.getByText('이 양의 기록을 볼 수 없어요')).toBeTruthy();
  await press('양떼로 돌아가기');
  expect(screen.getByText('나의 양떼')).toBeTruthy();
});

import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import {
  act,
  fireEvent,
  render as nativeRender,
  screen,
  renderHook,
} from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { NightExpiryBoundary } from './NightExpiryBoundary';
import { useNightExpiry } from './useNightExpiry';
import type { NightExpiryActions, NightExpirySnapshot } from './types';
import { NightEntryScreen } from '../NightEntryScreen';
import { createMockNightEntry } from '../../../mocks/nightEntry';
import { deferred } from '../../../notifications/__tests__/fakeDevice';
const tick = () =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(500);
  });
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
const snapshot = (closed = false): NightExpirySnapshot => ({
  server_time: closed ? '2026-11-16T19:00:00.000Z' : '2026-11-16T18:59:58.000Z',
  closes_at: '2026-11-16T19:00:00.000Z',
  closed,
});
const ui = (actions: NightExpiryActions, onMorning = () => {}) => {
  const entry = createMockNightEntry('success');
  return (
    <SafeAreaInsetsContext.Provider
      value={{ top: 28, bottom: 24, left: 0, right: 0 }}
    >
      <NightExpiryBoundary
        actions={actions}
        onMorning={onMorning}
        onHome={() => {}}
      >
        {() => <NightEntryScreen actions={entry} onBack={() => {}} />}
      </NightExpiryBoundary>
    </SafeAreaInsetsContext.Provider>
  );
};
let active: (state: string) => void;
beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_name, fn) => {
    active = (state) => fn(state as AppStateStatus);
    return { remove: () => {} };
  });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
it('checks the deadline, blocks the night and offers an explicit morning transition', async () => {
  const load = jest
      .fn<NightExpiryActions['load']>()
      .mockResolvedValueOnce(snapshot())
      .mockResolvedValue(snapshot(true)),
    morning = jest.fn();
  await nativeRender(ui({ load }, morning));
  await tick();
  expect(screen.getByLabelText('오늘의 고민')).toBeTruthy();
  await act(async () => {
    await jest.advanceTimersByTimeAsync(2000);
  });
  expect(screen.getByText('밤이 끝났어요')).toBeTruthy();
  expect(screen.queryByLabelText('오늘의 고민')).toBeNull();
  await press('아침으로 가기');
  expect(morning).toHaveBeenCalledTimes(1);
  expect(load).toHaveBeenCalledTimes(2);
});
it('keeps an unsubmitted worry through a foreground recheck and blocks it while verification fails', async () => {
  const wait = deferred<NightExpirySnapshot>(),
    load = jest
      .fn<NightExpiryActions['load']>()
      .mockResolvedValueOnce(snapshot())
      .mockImplementationOnce(() => wait.promise)
      .mockResolvedValue(snapshot());
  await nativeRender(ui({ load }));
  await tick();
  await fireEvent.press(screen.getByRole('radio', { name: '취업' }));
  await fireEvent.changeText(
    screen.getByLabelText('오늘의 고민'),
    '입력 중인 고민',
  );
  await act(async () => {
    active('background');
    active('active');
  });
  expect(screen.queryByLabelText('오늘의 고민')).toBeNull();
  await act(async () => wait.reject(new Error('temporary')));
  expect(screen.getByText('밤 시간을 확인하지 못했어요')).toBeTruthy();
  await press('다시 확인');
  await tick();
  expect(screen.getByLabelText('오늘의 고민')).toHaveDisplayValue(
    '입력 중인 고민',
  );
});
it('replaces an old pending check on foreground return and ignores a late response after source replacement', async () => {
  const old = deferred<NightExpirySnapshot>(),
    load = jest
      .fn<NightExpiryActions['load']>()
      .mockImplementationOnce(() => old.promise)
      .mockResolvedValue(snapshot());
  const first = { load };
  await nativeRender(ui(first));
  await act(async () => {
    active('background');
    active('active');
  });
  await tick();
  expect(load.mock.calls[0][0].aborted).toBe(true);
  const next = {
    load: jest.fn<NightExpiryActions['load']>().mockResolvedValue(snapshot()),
  };
  await screen.rerender(ui(next));
  await tick();
  await act(async () => old.resolve(snapshot(true)));
  expect(screen.queryByText('밤이 끝났어요')).toBeNull();
  expect(screen.getByLabelText('오늘의 고민')).toBeTruthy();
  await screen.unmount();
  await act(async () => {
    await jest.advanceTimersByTimeAsync(10000);
  });
  expect(load).toHaveBeenCalledTimes(2);
  expect(next.load).toHaveBeenCalledTimes(1);
});
it('cleans its own timer and pending request when the clock hook unmounts', async () => {
  const actions = {
    load: jest.fn<NightExpiryActions['load']>().mockResolvedValue(snapshot()),
  };
  const hook = await renderHook(() => useNightExpiry(actions));
  await tick();
  expect(jest.getTimerCount()).toBe(1);
  await hook.unmount();
  await jest.advanceTimersByTimeAsync(0);
  expect(jest.getTimerCount()).toBe(0);
});
it('rejects inconsistent clock data and retries without exposing night actions', async () => {
  const load = jest
    .fn<NightExpiryActions['load']>()
    .mockResolvedValueOnce({ ...snapshot(true), closed: false })
    .mockResolvedValue(snapshot(true));
  await nativeRender(ui({ load }));
  await tick();
  expect(screen.getByText('밤 시간을 확인하지 못했어요')).toBeTruthy();
  expect(screen.queryByLabelText('오늘의 고민')).toBeNull();
  await press('다시 확인');
  await tick();
  expect(screen.getByText('밤이 끝났어요')).toBeTruthy();
});

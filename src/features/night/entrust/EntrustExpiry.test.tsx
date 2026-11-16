import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, AppState, type AppStateStatus } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { HomeNightJourney } from '../../home/HomeNightJourney';
import {
  createEntrustPreview,
  type EntrustPreview,
} from '../../../mocks/entrustPreview';
import { signal, settle } from '../../../mocks/__tests__/nightHistory';
import { deferred } from '../../../notifications/__tests__/fakeDevice';
let listeners: Set<(state: AppStateStatus) => void>;
beforeEach(() => {
  jest.useFakeTimers();
  listeners = new Set();
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, fn) => {
    listeners.add(fn);
    return {
      remove: () => {
        listeners.delete(fn);
      },
    };
  });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
const tick = (ms = 1000) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
const app = (state: AppStateStatus) =>
  act(async () => {
    for (const fn of [...listeners]) fn(state);
  });
async function fixture(preset: EntrustPreview = 'expiry') {
  const f = await settle(createEntrustPreview(preset, signal())),
    began = performance.now();
  await render(
    <SafeAreaInsetsContext.Provider
      value={{ top: 28, bottom: 24, left: 0, right: 0 }}
    >
      <HomeNightJourney source={f.journey} initialNightOpen onExit={() => {}} />
    </SafeAreaInsetsContext.Provider>,
  );
  for (let i = 0; i < 3; i++) await tick();
  expect(screen.getByText('4 / 7')).toBeTruthy();
  return {
    ...f,
    to: (ms: number) => tick(Math.max(0, ms - (performance.now() - began))),
  };
}
async function morning(entrusted: boolean) {
  await press('아침으로 가기');
  for (let i = 0; i < 3; i++) await tick();
  expect(screen.queryByRole('radio', { name: '4번째 양' })).toBeNull();
  await press('어젯밤 돌아보기');
  await tick();
  expect(
    screen.getByText(entrusted ? /맡긴 걱정/ : /지난밤 걱정/),
  ).toBeTruthy();
}
it.each(['expiry-save', 'expiry-retry'] as const)(
  'aborts %s as soon as the deadline check blocks the feed and never replays it after expiry',
  async (preset) => {
    const f = await fixture(preset),
      save = jest.spyOn(f.demo.entrust!, 'save');
    if (preset === 'expiry-retry') {
      await press('맡기기');
      await tick(600);
      expect(screen.getByText('선택 결과를 확인하지 못했어요')).toBeTruthy();
    }
    await f.to(19000);
    await press(preset === 'expiry-retry' ? '선택 다시 시도' : '맡기기');
    const pending = save.mock.calls.at(-1)![1];
    await f.to(20000);
    expect(pending.aborted).toBe(true);
    await tick();
    expect(screen.getByText('밤이 끝났어요')).toBeTruthy();
    await tick(8000);
    expect(f.demo.getProgress().position).toBe(4);
    expect(f.demo.getRecord().night?.entrusted).toBe(false);
    expect(screen.queryByRole('button', { name: '선택 다시 시도' })).toBeNull();
    expect(save).toHaveBeenCalledTimes(preset === 'expiry-retry' ? 2 : 1);
    await morning(false);
  },
);
it('retains a server-confirmed choice with a delayed receipt but ignores its late UI completion after expiration', async () => {
  const f = await fixture(),
    a = f.demo.entrust!,
    original = a.save,
    late = deferred<void>();
  const save = jest.spyOn(a, 'save').mockImplementation(async (action, s) => {
    const value = await original(action, s);
    await late.promise;
    return value;
  });
  await press('맡기기');
  await tick(600);
  expect(f.demo.getRecord().night?.entrusted).toBe(true);
  await f.to(21000);
  expect(save.mock.calls[0][1].aborted).toBe(true);
  await act(async () => late.resolve(undefined));
  await tick(3000);
  expect(screen.getByText('밤이 끝났어요')).toBeTruthy();
  expect(f.demo.getProgress().position).toBe(4);
  await morning(true);
});
it('cancels an unconfirmed choice in the background and closes it on the foreground time recheck', async () => {
  const f = await fixture('expiry-save'),
    save = jest.spyOn(f.demo.entrust!, 'save');
  await press('맡기기');
  await app('background');
  expect(save.mock.calls[0][1].aborted).toBe(true);
  await f.to(22000);
  await app('active');
  await tick();
  expect(screen.getByText('밤이 끝났어요')).toBeTruthy();
  expect(f.demo.getRecord().night?.entrusted).toBe(false);
  expect(f.demo.getProgress().position).toBe(4);
  await morning(false);
});
it('requeries a confirmed choice on foreground return without replaying its cancelled automatic move', async () => {
  const f = await fixture();
  await press('맡기기');
  await tick(600);
  await app('background');
  await tick(3000);
  expect(f.demo.getProgress().position).toBe(4);
  await app('active');
  await tick();
  await tick();
  await tick(2000);
  expect(
    screen.getByText('잘 받았어요. 오늘 밤은 내가 들고 있을게요.'),
  ).toBeTruthy();
  expect(f.demo.getProgress().position).toBe(4);
  await press('다음 양');
  expect(f.demo.getProgress().position).toBe(5);
});

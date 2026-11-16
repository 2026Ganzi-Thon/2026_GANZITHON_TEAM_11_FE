import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, AppState, type AppStateStatus } from 'react-native';
import { HomeNightJourney } from '../../home/HomeNightJourney';
import { createStopOfferJourney } from '../../../mocks/stopOfferJourney';
import { signal, settle } from '../../../mocks/__tests__/nightHistory';
import { deferred } from '../../../notifications/__tests__/fakeDevice';
import type { ClosingResult } from '../closing/types';
let states: Set<(s: AppStateStatus) => void>;
beforeEach(() => {
  jest.useFakeTimers();
  states = new Set();
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, fn) => {
    states.add(fn);
    return {
      remove: () => {
        states.delete(fn);
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
const app = (s: AppStateStatus) =>
  act(async () => {
    for (const fn of [...states]) fn(s);
  });
async function fixture(
  preset: 'expiry-save' | 'expiry-retry' | 'expiry' | 'lost' = 'expiry',
) {
  const source = await settle(createStopOfferJourney(preset, signal())),
    began = performance.now();
  await render(
    <HomeNightJourney source={source} initialNightOpen onExit={() => {}} />,
  );
  for (let i = 0; i < 3; i++) await tick();
  expect(screen.getByText('14 / 20')).toBeTruthy();
  return {
    source,
    to: (ms: number) => tick(Math.max(0, ms - (performance.now() - began))),
  };
}
async function morning() {
  await press('아침으로 가기');
  for (let i = 0; i < 3; i++) await tick();
  expect(screen.queryByRole('radio', { name: '14번째 양' })).toBeNull();
  expect(screen.getByText(/어젯밤 양 14마리가/)).toBeTruthy();
}
it.each(['expiry-save', 'expiry-retry'] as const)(
  'aborts %s on the first deadline check and never saves or auto-advances after expiry',
  async (preset) => {
    const f = await fixture(preset),
      finish = jest.spyOn(f.source.night.closing, 'finish');
    if (preset === 'expiry-retry') {
      await press('그만 셀래요');
      await tick();
      expect(screen.getByText('마무리를 준비하지 못했어요')).toBeTruthy();
    }
    await f.to(19000);
    await press(preset === 'expiry-retry' ? '다시 시도' : '그만 셀래요');
    const pending = finish.mock.calls.at(-1)![2];
    await f.to(20000);
    expect(pending.aborted).toBe(true);
    await tick();
    await tick(7000);
    expect(screen.getByText('밤이 끝났어요')).toBeTruthy();
    expect(f.source.night.getRecord()).toMatchObject({
      expired: true,
      counted: 14,
    });
    expect(f.source.night.getProgress().position).toBe(14);
    expect(finish).toHaveBeenCalledTimes(preset === 'expiry-retry' ? 2 : 1);
    expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull();
    await morning();
  },
);
it('cancels a pending close in the background and expires it on return without retrying', async () => {
  const f = await fixture('expiry-save'),
    finish = jest.spyOn(f.source.night.closing, 'finish');
  await press('그만 셀래요');
  await app('background');
  expect(finish.mock.calls[0][2].aborted).toBe(true);
  await f.to(22000);
  await app('active');
  await tick();
  expect(screen.getByText('밤이 끝났어요')).toBeTruthy();
  expect(f.source.night.getRecord().expired).toBe(true);
  expect(finish).toHaveBeenCalledTimes(1);
  await morning();
});
it('ignores a confirmed finish receipt arriving after expiry and does not add its unviewed warm card', async () => {
  const f = await fixture(),
    original = f.source.night.closing.finish,
    late = deferred<ClosingResult>();
  let confirmed: ClosingResult | undefined;
  const finish = jest
    .spyOn(f.source.night.closing, 'finish')
    .mockImplementationOnce(async (...args) => {
      confirmed = await original(...args);
      return late.promise;
    });
  await press('그만 셀래요');
  await tick();
  await f.to(21000);
  expect(finish.mock.calls[0][2].aborted).toBe(true);
  await act(async () => late.resolve(confirmed!));
  expect(screen.getByText('밤이 끝났어요')).toBeTruthy();
  expect(f.source.night.getRecord().expired).toBe(false);
  expect(f.source.night.getProgress().position).toBe(14);
  const m = await settle(f.source.night.morning.loadMorning(signal()));
  expect(
    m.candidate_cards.some((c) => c.card.id === confirmed!.closing_card!.id),
  ).toBe(false);
  await morning();
});
it('replays a confirmed finish with its original key after returning before 04:00', async () => {
  const f = await fixture(),
    original = f.source.night.closing.finish,
    late = deferred<ClosingResult>();
  let confirmed: ClosingResult | undefined;
  const finish = jest
    .spyOn(f.source.night.closing, 'finish')
    .mockImplementationOnce(async (...args) => {
      confirmed = await original(...args);
      return late.promise;
    });
  await press('그만 셀래요');
  await tick();
  await app('background');
  expect(finish.mock.calls[0][2].aborted).toBe(true);
  await app('active');
  await tick();
  await tick();
  await act(async () => late.resolve(confirmed!));
  expect(finish).toHaveBeenCalledTimes(2);
  expect(finish.mock.calls[1][1]).toBe(finish.mock.calls[0][1]);
  expect(
    screen.getByText('오늘은 여기까지 해도 괜찮아.\n남은 밤은 편안히 쉬어.'),
  ).toBeTruthy();
  expect(f.source.night.getProgress().position).toBe(14);
});

it('recovers the integrated lost-receipt scenario with the same finish operation', async () => {
  const f = await fixture('lost'),
    finish = jest.spyOn(f.source.night.closing, 'finish');
  await press('그만 셀래요');
  await tick();
  expect(screen.getByText('마무리를 준비하지 못했어요')).toBeTruthy();
  expect(f.source.night.getRecord().counted).toBe(14);
  await press('다시 시도');
  await tick();
  expect(finish).toHaveBeenCalledTimes(2);
  expect(finish.mock.calls[1][1]).toBe(finish.mock.calls[0][1]);
  expect(
    screen.getByText('오늘은 여기까지 해도 괜찮아.\n남은 밤은 편안히 쉬어.'),
  ).toBeTruthy();
  await press('다음');
  await tick();
  expect(screen.getByText('오늘은 14마리까지 셌어요')).toBeTruthy();
});

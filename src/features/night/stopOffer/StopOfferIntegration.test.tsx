import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { createNightMorningDemo } from '../../../mocks/nightMorningDemo';
import { signal, settle, start } from '../../../mocks/__tests__/nightHistory';
import { FeedScreen } from '../feed/FeedScreen';
import { NightMorningFlow } from '../../demo/NightMorningFlow';
import { createNightMorningNavigation } from '../../demo/navigation';
import type { ClosingRequest } from '../closing/types';
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
const tick = (ms = 1000) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
beforeEach(() => {
  jest.useFakeTimers();
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
it.each([
  ['worry', '첫 고민'],
  ['none', null],
] as const)(
  'offers stopping with %s and excludes both pause slots from all reactions and morning candidates',
  async (_kind, text) => {
    const d = createNightMorningDemo();
    await start(d, 20, text);
    expect(d.stopOffer).toMatchObject({ position: 14 });
    d.progress({ position: 14, furthestPosition: 14 });
    const cards = await settle(d.loadFeed(signal()));
    expect(cards[13]).toMatchObject({ available: false, content: null });
    await expect(
      settle(d.yarn.set(cards[13].id, true, signal())),
    ).rejects.toBeTruthy();
    const input: ClosingRequest = {
      reason: 'stop_pause',
      position: 14,
      furthestPosition: 14,
      sheepCount: 20,
    };
    const result = await settle(d.closing.finish(input, 'stop', signal()));
    await settle(
      d.closing.markViewed(result.closing_card!.id, 'view', signal()),
    );
    d.advanceMorning();
    const morning = await settle(d.morning.loadMorning(signal()));
    expect(morning.counted_sheep).toBe(14);
    expect(morning.candidate_cards.some((c) => c.position === 14)).toBe(false);
    if (text)
      expect(morning.candidate_cards.some((c) => c.position === 6)).toBe(false);
    expect(
      morning.candidate_cards.some(
        (c) => c.card.id === result.closing_card!.id && c.position === null,
      ),
    ).toBe(true);
  },
);
it('does not create a stop slot for fifteen sheep or accept stop_pause away from the actual slot', async () => {
  const d = createNightMorningDemo();
  await start(d, 15);
  expect(d.stopOffer).toBeUndefined();
  d.progress({ position: 14, furthestPosition: 14 });
  await expect(
    settle(
      d.closing.finish(
        {
          reason: 'stop_pause',
          position: 14,
          furthestPosition: 14,
          sheepCount: 15,
        },
        'invalid',
        signal(),
      ),
    ),
  ).rejects.toMatchObject({ code: 'INVALID_PROGRESS' });
});
it('continues and revisits the offer without finishing or showing card reaction controls', async () => {
  const d = createNightMorningDemo();
  await start(d, 20);
  d.progress({ position: 14, furthestPosition: 14 });
  const finish = jest.spyOn(d.closing, 'finish');
  await render(
    <FeedScreen
      load={d.loadFeed}
      stopOffer={d.stopOffer}
      entrust={d.entrust}
      yarn={d.yarn}
      fluff={d.fluff}
      songs={d.songs}
      initialPosition={d.getProgress()}
      onProgress={d.progress}
      onBack={() => {}}
      closingActions={d.closing}
    />,
  );
  await tick();
  expect(screen.getByRole('button', { name: '그만 셀래요' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: '털실 보내기' })).toBeNull();
  expect(screen.queryByRole('button', { name: '솜털 붙이기' })).toBeNull();
  await press('계속 셀래요');
  expect(d.getProgress().position).toBe(15);
  expect(finish).not.toHaveBeenCalled();
  await press('이전 양');
  expect(d.getProgress().position).toBe(14);
  expect(screen.getByRole('button', { name: '그만 셀래요' })).toBeTruthy();
});
it('shows the warm card first for stop_pause and preserves the maximum reached count after going backward', async () => {
  const d = createNightMorningDemo();
  await start(d, 20);
  d.progress({ position: 14, furthestPosition: 18 });
  const nav = createNightMorningNavigation();
  nav.setPage('feed');
  const finish = jest.spyOn(d.closing, 'finish');
  await render(
    <NightMorningFlow demo={d} navigation={nav} onExit={() => {}} />,
  );
  await tick();
  await press('그만 셀래요');
  await tick();
  expect(finish).toHaveBeenCalledWith(
    {
      reason: 'stop_pause',
      position: 14,
      furthestPosition: 18,
      sheepCount: 20,
    },
    expect.any(String),
    expect.any(AbortSignal),
  );
  expect(
    screen.getByText('오늘은 여기까지 해도 괜찮아.\n남은 밤은 편안히 쉬어.'),
  ).toBeTruthy();
  expect(screen.queryByText('오늘은 18마리까지 셌어요')).toBeNull();
  await press('다음');
  await tick();
  expect(screen.getByText('오늘은 18마리까지 셌어요')).toBeTruthy();
});
it('does not advance or finish while a foreground time check blocks the stop slot', async () => {
  const d = createNightMorningDemo();
  await start(d, 20);
  d.progress({ position: 14, furthestPosition: 14 });
  const finish = jest.fn();
  await render(
    <FeedScreen
      load={d.loadFeed}
      stopOffer={d.stopOffer}
      initialPosition={d.getProgress()}
      onProgress={d.progress}
      onBack={() => {}}
      onFinish={finish}
      blocked
    />,
  );
  await tick();
  expect(screen.getByRole('button', { name: '그만 셀래요' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '계속 셀래요' })).toBeDisabled();
  await press('그만 셀래요');
  await press('계속 셀래요');
  expect(finish).not.toHaveBeenCalled();
  expect(d.getProgress().position).toBe(14);
});

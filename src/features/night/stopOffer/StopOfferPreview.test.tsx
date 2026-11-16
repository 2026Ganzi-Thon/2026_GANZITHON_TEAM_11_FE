import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createMockStopOffer } from '../../../mocks/stopOffer';
import { StopOfferDemo, StopOfferPreview } from './StopOfferPreview';
import { deferred } from '../../../notifications/__tests__/fakeDevice';
import type { ClosingResult } from '../closing/types';
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
const tick = (ms = 1000) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
it.each([16, 30])(
  'stops at fourteen of %s and shows a warm card before the partial summary',
  async (count) => {
    const source = createMockStopOffer(count);
    expect(source).not.toBeNull();
    if (!source) return;
    const finish = jest.spyOn(source.closing, 'finish');
    await render(<StopOfferDemo source={source} onBack={() => {}} />);
    await press('그만 셀래요');
    await tick();
    expect(finish).toHaveBeenCalledTimes(1);
    expect(finish).toHaveBeenCalledWith(
      {
        reason: 'leave',
        position: 14,
        furthestPosition: 14,
        sheepCount: count,
      },
      expect.any(String),
      expect.any(AbortSignal),
    );
    expect(
      screen.getByText('오늘은 여기까지 해도 괜찮아.\n남은 밤은 편안히 쉬어.'),
    ).toBeTruthy();
    expect(screen.queryByText('오늘은 14마리까지 셌어요')).toBeNull();
    await press('다음');
    await tick();
    expect(screen.getByText('오늘은 14마리까지 셌어요')).toBeTruthy();
  },
);
it('does not finish when choosing to continue and can return to the offer', async () => {
  const source = createMockStopOffer(20)!;
  const finish = jest.spyOn(source.closing, 'finish');
  await render(<StopOfferDemo source={source} onBack={() => {}} />);
  await press('계속 셀래요');
  await tick();
  expect(screen.getByText('계속 세기를 선택했어요')).toBeTruthy();
  expect(finish).not.toHaveBeenCalled();
  await press('선택 다시 보기');
  expect(screen.getByRole('button', { name: '그만 셀래요' })).toBeTruthy();
  expect(finish).not.toHaveBeenCalled();
});
it('restores a lost closing receipt with the original operation before showing its one warm card', async () => {
  const source = createMockStopOffer(20, 'finish-lost')!;
  const finish = jest.spyOn(source.closing, 'finish');
  await render(<StopOfferDemo source={source} onBack={() => {}} />);
  await press('그만 셀래요');
  await tick();
  expect(screen.getByText('마무리를 준비하지 못했어요')).toBeTruthy();
  await press('다시 시도');
  await tick();
  expect(finish).toHaveBeenCalledTimes(2);
  expect(finish.mock.calls[1][0]).toEqual(finish.mock.calls[0][0]);
  expect(finish.mock.calls[1][1]).toBe(finish.mock.calls[0][1]);
  expect(
    screen.getAllByText('오늘은 여기까지 해도 괜찮아.\n남은 밤은 편안히 쉬어.'),
  ).toHaveLength(1);
  await press('다음');
  await tick();
  expect(screen.getByText('오늘은 14마리까지 셌어요')).toBeTruthy();
});
it('keeps the warm card when acknowledging it fails and only shows the summary after retry', async () => {
  const source = createMockStopOffer(20, 'view-retry')!;
  await render(<StopOfferDemo source={source} onBack={() => {}} />);
  await press('그만 셀래요');
  await tick();
  await press('다음');
  await tick();
  expect(screen.getByText('선택을 확인하지 못했어요')).toBeTruthy();
  expect(screen.queryByText('오늘은 14마리까지 셌어요')).toBeNull();
  await press('다시 시도');
  await tick();
  expect(screen.getByText('오늘은 14마리까지 셌어요')).toBeTruthy();
});
it('aborts an old closing operation on source replacement and ignores its delayed receipt', async () => {
  const first = createMockStopOffer(16)!,
    next = createMockStopOffer(30)!,
    late = deferred<ClosingResult>();
  const original = first.closing.finish;
  let confirmed: ClosingResult | undefined;
  const finish = jest
    .spyOn(first.closing, 'finish')
    .mockImplementation(async (...args) => {
      confirmed = await original(...args);
      return late.promise;
    });
  await render(<StopOfferDemo source={first} onBack={() => {}} />);
  await press('그만 셀래요');
  await tick();
  await screen.rerender(<StopOfferDemo source={next} onBack={() => {}} />);
  expect(finish.mock.calls[0][2].aborted).toBe(true);
  await act(async () => late.resolve(confirmed!));
  expect(screen.getByText('14 / 30')).toBeTruthy();
  expect(screen.getByRole('button', { name: '그만 셀래요' })).toBeTruthy();
  expect(
    screen.queryByText('오늘은 여기까지 해도 괜찮아.\n남은 밤은 편안히 쉬어.'),
  ).toBeNull();
});
it('exits a pending close once and aborts its request', async () => {
  const source = createMockStopOffer(20)!,
    onBack = jest.fn();
  const finish = jest.spyOn(source.closing, 'finish');
  await render(<StopOfferDemo source={source} onBack={onBack} />);
  await press('그만 셀래요');
  await press('미리보기 나가기');
  expect(onBack).toHaveBeenCalledTimes(1);
  expect(finish.mock.calls[0][2].aborted).toBe(true);
  await tick();
  expect(
    screen.queryByText('오늘은 여기까지 해도 괜찮아.\n남은 밤은 편안히 쉬어.'),
  ).toBeNull();
});
it('starts a new preset without retaining the previous continue choice', async () => {
  await render(<StopOfferPreview onExit={() => {}} />);
  await press('16마리 · 첫 등장');
  await press('계속 셀래요');
  await press('시연 선택으로');
  await press('30마리 · 그만 세기');
  expect(screen.getByText('14 / 30')).toBeTruthy();
  expect(screen.getByRole('button', { name: '그만 셀래요' })).toBeTruthy();
});
it('cannot construct a stop offer below its threshold', () => {
  expect(createMockStopOffer(15)).toBeNull();
});

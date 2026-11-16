import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ClosingScreen } from '../closing/ClosingScreen';
import { createMockStopOffer } from '../../../mocks/stopOffer';
import { deferred } from '../../../notifications/__tests__/fakeDevice';
import type { ClosingResult } from '../closing/types';
const tick = () =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(1000);
  });
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
it('aborts a pending close during verification and recovers the confirmed receipt with the same key on return', async () => {
  jest.useFakeTimers();
  const source = createMockStopOffer(20)!,
    late = deferred<ClosingResult>(),
    original = source.closing.finish;
  let confirmed: ClosingResult | undefined;
  const finish = jest
    .spyOn(source.closing, 'finish')
    .mockImplementationOnce(async (...args) => {
      confirmed = await original(...args);
      return late.promise;
    });
  const exit = jest.fn();
  const view = (blocked: boolean) => (
    <ClosingScreen
      input={source.input}
      actions={source.closing}
      onExit={exit}
      blocked={blocked}
    />
  );
  await render(view(false));
  await tick();
  await screen.rerender(view(true));
  expect(finish.mock.calls[0][2].aborted).toBe(true);
  await act(async () => late.resolve(confirmed!));
  expect(screen.queryByRole('button', { name: '다음' })).toBeNull();
  await screen.rerender(view(false));
  await tick();
  expect(finish).toHaveBeenCalledTimes(2);
  expect(finish.mock.calls[1][1]).toBe(finish.mock.calls[0][1]);
  expect(
    screen.getByText('오늘은 여기까지 해도 괜찮아.\n남은 밤은 편안히 쉬어.'),
  ).toBeTruthy();
  expect(exit).not.toHaveBeenCalled();
});
it('cannot acknowledge a warm card or retry a failure while verification blocks closing', async () => {
  jest.useFakeTimers();
  const source = createMockStopOffer(20, 'view-retry')!,
    mark = jest.spyOn(source.closing, 'markViewed');
  const view = (blocked: boolean) => (
    <ClosingScreen
      input={source.input}
      actions={source.closing}
      onExit={() => {}}
      blocked={blocked}
    />
  );
  await render(view(false));
  await tick();
  await screen.rerender(view(true));
  await press('다음');
  expect(mark).not.toHaveBeenCalled();
  await screen.rerender(view(false));
  await press('다음');
  await tick();
  expect(screen.getByText('선택을 확인하지 못했어요')).toBeTruthy();
  await screen.rerender(view(true));
  await press('다시 시도');
  expect(mark).toHaveBeenCalledTimes(1);
});

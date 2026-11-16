import { afterEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import { NightReturnScreen } from './NightReturnScreen';
import { returnRecord } from './__tests__/fixture';
afterEach(() => {
  jest.restoreAllMocks();
});
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
it.each([3, 5, 10] as const)(
  'passes the selected %s sheep only on the explicit restart action',
  async (count) => {
    const restart = jest.fn(),
      rest = jest.fn();
    await render(
      <NightReturnScreen
        record={returnRecord()}
        onRestart={restart}
        onRest={rest}
      />,
    );
    if (count !== 5)
      await fireEvent.press(
        screen.getByRole('radio', { name: `${count}마리` }),
      );
    expect(restart).not.toHaveBeenCalled();
    await press(`${count}마리 더 세기`);
    expect(restart).toHaveBeenCalledWith(count);
    expect(rest).not.toHaveBeenCalled();
  },
);
it('rests without requesting a new session', async () => {
  const restart = jest.fn(),
    rest = jest.fn();
  await render(
    <NightReturnScreen
      record={returnRecord()}
      onRestart={restart}
      onRest={rest}
    />,
  );
  await press('그냥 누워 있을게요');
  expect(rest).toHaveBeenCalledTimes(1);
  expect(restart).not.toHaveBeenCalled();
});
it('preserves the selection for a fresh copy of the same record and resets it for a newer record', async () => {
  const view = (record: ReturnType<typeof returnRecord>) => (
    <NightReturnScreen record={record} onRestart={() => {}} onRest={() => {}} />
  );
  await render(view(returnRecord()));
  await fireEvent.press(screen.getByRole('radio', { name: '10마리' }));
  await screen.rerender(view(returnRecord()));
  expect(screen.getByRole('button', { name: '10마리 더 세기' })).toBeTruthy();
  await screen.rerender(
    view(returnRecord({ counted: 20, finished_at: '2026-11-16T16:30:00Z' })),
  );
  expect(screen.getByRole('radio', { name: '5마리' })).toBeChecked();
});
it('distinguishes a stopped night and does not claim an unentrusted worry was entrusted', async () => {
  await render(
    <NightReturnScreen
      record={returnRecord({
        status: 'stopped',
        counted: 14,
        entrusted_count: 0,
      })}
      onRestart={() => {}}
      onRest={() => {}}
    />,
  );
  expect(screen.getByText('01:12에 14마리까지 셌어요')).toBeTruthy();
  expect(screen.queryByText(/아까 맡긴 걱정/)).toBeNull();
  expect(screen.getByText('맡긴 걱정 0개 · 솜털 2개 · 털실 1개')).toBeTruthy();
});
it('keeps pending and failure actions separate from a fresh restart', async () => {
  const restart = jest.fn(),
    retry = jest.fn();
  const record = returnRecord();
  const view = (pending: boolean, error: boolean) => (
    <NightReturnScreen
      record={record}
      onRestart={restart}
      onRest={() => {}}
      pending={pending}
      error={error}
      onRetry={retry}
    />
  );
  await render(view(true, false));
  expect(
    screen.getByRole('button', { name: '밤 상태 확인 중' }),
  ).toBeDisabled();
  expect(screen.getByRole('radio', { name: '10마리' })).toBeDisabled();
  await screen.rerender(view(false, true));
  await press('다시 확인');
  expect(retry).toHaveBeenCalledTimes(1);
  expect(restart).not.toHaveBeenCalled();
});
it('treats Android back as resting and removes the listener', async () => {
  let back: (() => boolean | undefined) | undefined;
  const remove = jest.fn();
  jest
    .spyOn(BackHandler, 'addEventListener')
    .mockImplementation((_event, fn) => {
      back = () => fn({} as Parameters<typeof fn>[0]);
      return { remove };
    });
  const rest = jest.fn(),
    restart = jest.fn();
  await render(
    <NightReturnScreen
      record={returnRecord()}
      onRestart={restart}
      onRest={rest}
    />,
  );
  expect(back?.()).toBe(true);
  expect(rest).toHaveBeenCalledTimes(1);
  expect(restart).not.toHaveBeenCalled();
  await screen.unmount();
  expect(remove).toHaveBeenCalledTimes(1);
});

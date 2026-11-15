import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { HomeTime } from './HomeTime';
import type { HomeClockActions, HomeSnapshot } from './model';
const day: HomeSnapshot = {
  server_time: '2026-11-15T20:59:59+09:00',
  timezone: 'Asia/Seoul',
  phase: 'day',
  user: { id: 'u', stats: { night_count: 0 } },
};
const night: HomeSnapshot = {
  ...day,
  server_time: '2026-11-15T21:00:00+09:00',
  phase: 'night',
};
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
it('refreshes at 21:00 without using the phone wall clock and validates again before opening the night', async () => {
  const load = jest
      .fn<HomeClockActions['load']>()
      .mockResolvedValueOnce(day)
      .mockResolvedValue(night),
    open = jest.fn();
  await render(<HomeTime actions={{ load }} onNight={open} />);
  expect(
    screen.getByRole('button', { name: '밤 9시에 열려요' }),
  ).toBeDisabled();
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2040-01-01T01:00:00Z'));
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1000);
  });
  expect(
    screen.getByRole('button', { name: '오늘 밤 양 세러 가기' }),
  ).toBeEnabled();
  expect(open).not.toHaveBeenCalled();
  await press('오늘 밤 양 세러 가기');
  expect(open).toHaveBeenCalledTimes(1);
  expect(load).toHaveBeenCalledTimes(3);
});
it('does not open from a cached night snapshot when the press-time response has crossed 04:00', async () => {
  const load = jest
      .fn<HomeClockActions['load']>()
      .mockResolvedValueOnce(night)
      .mockResolvedValue({ ...day, server_time: '2026-11-16T04:00:00+09:00' }),
    open = jest.fn();
  await render(<HomeTime actions={{ load }} onNight={open} />);
  await press('오늘 밤 양 세러 가기');
  expect(open).not.toHaveBeenCalled();
  expect(
    screen.getByRole('button', { name: '밤 9시에 열려요' }),
  ).toBeDisabled();
});
it('automatically closes at 04:00 and removes its boundary timer and foreground listener on unmount', async () => {
  const remove = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove });
  const load = jest
    .fn<HomeClockActions['load']>()
    .mockResolvedValueOnce({
      ...night,
      server_time: '2026-11-16T03:59:59+09:00',
    })
    .mockResolvedValue({ ...day, server_time: '2026-11-16T04:00:00+09:00' });
  const view = await render(<HomeTime actions={{ load }} onNight={() => {}} />);
  expect(
    screen.getByRole('button', { name: '오늘 밤 양 세러 가기' }),
  ).toBeEnabled();
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1000);
  });
  expect(
    screen.getByRole('button', { name: '밤 9시에 열려요' }),
  ).toBeDisabled();
  await view.unmount();
  expect(remove).toHaveBeenCalledTimes(1);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(17 * 60 * 60 * 1000);
  });
  expect(load).toHaveBeenCalledTimes(2);
  expect(jest.getTimerCount()).toBe(0);
});
it('blocks duplicate verification, disables an uncertain clock and permits an explicit retry', async () => {
  const load = jest.fn<HomeClockActions['load']>().mockResolvedValueOnce(night),
    open = jest.fn();
  let reject!: (e: Error) => void;
  load.mockImplementationOnce(
    () =>
      new Promise((_, r) => {
        reject = r;
      }),
  );
  await render(<HomeTime actions={{ load }} onNight={open} />);
  const button = screen.getByRole('button', { name: '오늘 밤 양 세러 가기' });
  await fireEvent.press(button);
  await fireEvent.press(button);
  expect(load).toHaveBeenCalledTimes(2);
  await act(async () => reject(new Error('private error')));
  expect(
    screen.getByRole('button', { name: '시간을 확인해 주세요' }),
  ).toBeDisabled();
  expect(screen.queryByText('private error')).toBeNull();
  load.mockResolvedValue(night);
  await press('홈 상태 다시 확인');
  await press('오늘 밤 양 세러 가기');
  expect(open).toHaveBeenCalledTimes(1);
});
it('cancels old work and refreshes on foreground return without letting a late response open the night', async () => {
  let change!: (state: AppStateStatus) => void;
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, listener) => {
      change = listener;
      return { remove: jest.fn() };
    });
  const load = jest.fn<HomeClockActions['load']>().mockResolvedValue(night),
    open = jest.fn();
  let resolve!: (value: HomeSnapshot) => void;
  await render(<HomeTime actions={{ load }} onNight={open} />);
  load.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  await press('오늘 밤 양 세러 가기');
  const signal = load.mock.calls[1][0];
  await act(async () => change('background'));
  expect(signal.aborted).toBe(true);
  load.mockResolvedValue(day);
  await act(async () => change('active'));
  await act(async () => resolve(night));
  expect(open).not.toHaveBeenCalled();
  expect(
    screen.getByRole('button', { name: '밤 9시에 열려요' }),
  ).toBeDisabled();
});
it('aborts a pending source and never applies its late result to a new home', async () => {
  let resolve!: (value: HomeSnapshot) => void;
  const old = {
      load: jest.fn<HomeClockActions['load']>().mockImplementation(
        () =>
          new Promise((r) => {
            resolve = r;
          }),
      ),
    },
    next = { load: jest.fn<HomeClockActions['load']>().mockResolvedValue(day) },
    open = jest.fn();
  const view = await render(<HomeTime actions={old} onNight={open} />);
  await view.rerender(<HomeTime actions={next} onNight={open} />);
  expect(old.load.mock.calls[0][0].aborted).toBe(true);
  await act(async () => resolve(night));
  expect(
    screen.getByRole('button', { name: '밤 9시에 열려요' }),
  ).toBeDisabled();
  expect(open).not.toHaveBeenCalled();
});

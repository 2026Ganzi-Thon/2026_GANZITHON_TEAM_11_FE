import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AppState, BackHandler, type AppStateStatus } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { HomeNightJourney } from '../../home/HomeNightJourney';
import { createNightExpiryPreview } from '../../../mocks/nightExpiryPreview';
import { signal, settle } from '../../../mocks/__tests__/nightHistory';
import { deferred } from '../../../notifications/__tests__/fakeDevice';
import type { NightExpirySnapshot } from './types';

const tick = async () => {
  for (let i = 0; i < 3; i++)
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });
};
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
let backs: (() => boolean | null | undefined)[],
  states: Set<(state: AppStateStatus) => void>;
beforeEach(() => {
  jest.useFakeTimers();
  backs = [];
  states = new Set();
  jest
    .spyOn(BackHandler, 'addEventListener')
    .mockImplementation((_event, callback) => {
      const listener = () => callback({} as Parameters<typeof callback>[0]);
      backs.push(listener);
      return {
        remove: () => {
          backs = backs.filter((fn) => fn !== listener);
        },
      };
    });
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, callback) => {
      states.add(callback);
      return {
        remove: () => {
          states.delete(callback);
        },
      };
    });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
async function hardwareBack() {
  let handled = false;
  await act(async () => {
    handled = [...backs].reverse().some((listener) => listener() === true);
  });
  expect(handled).toBe(true);
}
async function view(
  source: Awaited<ReturnType<typeof createNightExpiryPreview>>,
) {
  const exit = jest.fn();
  await render(
    <SafeAreaInsetsContext.Provider
      value={{ top: 28, bottom: 24, left: 0, right: 0 }}
    >
      <HomeNightJourney source={source} initialNightOpen onExit={exit} />
    </SafeAreaInsetsContext.Provider>,
  );
  return exit;
}
it.each(['pending', 'failed'] as const)(
  'returns from an initial %s clock check to the same home and resumes 2/5 without leaving the journey',
  async (phase) => {
    const source = await settle(createNightExpiryPreview('partial', signal()));
    const originalNight = source.night,
      wait = deferred<NightExpirySnapshot>();
    const load = jest
      .spyOn(originalNight.expiry!, 'load')
      .mockImplementationOnce(() => wait.promise);
    const exit = await view(source);
    expect(screen.getByText('밤 시간을 확인하고 있어요')).toBeTruthy();
    if (phase === 'failed')
      await act(async () => wait.reject(new Error('temporary')));
    if (phase === 'failed')
      expect(screen.getByText('밤 시간을 확인하지 못했어요')).toBeTruthy();
    await hardwareBack();
    await tick();
    expect(exit).not.toHaveBeenCalled();
    expect(source.night).toBe(originalNight);
    expect(
      screen.getByRole('button', { name: '오늘 밤 양 세러 가기' }),
    ).toBeEnabled();
    if (phase === 'pending') expect(load.mock.calls[0][0].aborted).toBe(true);
    await press('오늘 밤 양 세러 가기');
    await tick();
    expect(screen.getByText('2 / 5')).toBeTruthy();
    expect(source.night.getSession()).toMatchObject({
      sheepCount: 5,
      position: 2,
      furthestPosition: 2,
    });
    if (phase === 'pending') {
      await act(async () =>
        wait.resolve({
          server_time: '2026-11-16T19:00:00Z',
          closes_at: '2026-11-16T19:00:00Z',
          closed: true,
        }),
      );
      expect(screen.queryByText('밤이 끝났어요')).toBeNull();
      expect(screen.getByText('2 / 5')).toBeTruthy();
    }
  },
);
it('handles back from the expired status as the morning action and preserves the two confirmed candidates', async () => {
  const source = await settle(createNightExpiryPreview('partial', signal()));
  const exit = await view(source);
  await tick();
  await act(async () => {
    await jest.advanceTimersByTimeAsync(31000);
  });
  expect(screen.getByText('밤이 끝났어요')).toBeTruthy();
  await hardwareBack();
  await tick();
  expect(exit).not.toHaveBeenCalled();
  expect(screen.getByRole('radio', { name: '2번째 양' })).toBeTruthy();
  expect(screen.getByRole('radio', { name: '1번째 양' })).toBeTruthy();
  expect(screen.queryByRole('radio', { name: '3번째 양' })).toBeNull();
});
it('leaves the already-open feed back action to its own pause screen', async () => {
  const source = await settle(createNightExpiryPreview('partial', signal()));
  const exit = await view(source);
  await tick();
  await hardwareBack();
  expect(screen.getByText('시연을 잠깐 멈췄어요')).toBeTruthy();
  expect(exit).not.toHaveBeenCalled();
  await press('이어 보기');
  await tick();
  expect(screen.getByText('2 / 5')).toBeTruthy();
});
it('handles Android Modal requestClose during a foreground recheck as home and ignores its late result', async () => {
  const source = await settle(createNightExpiryPreview('partial', signal()));
  const exit = await view(source);
  await tick();
  expect(screen.getByText('2 / 5')).toBeTruthy();
  const wait = deferred<NightExpirySnapshot>();
  const load = jest
    .spyOn(source.night.expiry!, 'load')
    .mockImplementationOnce(() => wait.promise);
  await act(async () => {
    for (const next of ['background', 'active'] as const)
      for (const callback of [...states]) callback(next);
  });
  expect(screen.queryByText('2 / 5')).toBeNull();
  // Android Modal dispatches requestClose instead of a BackHandler event.
  const message = screen.getByText('밤 시간을 확인하고 있어요');
  let modal: typeof message | null = message;
  while (modal && typeof modal.props.onRequestClose !== 'function')
    modal = modal.parent;
  expect(modal).not.toBeNull();
  await fireEvent(modal!, 'requestClose');
  await tick();
  expect(exit).not.toHaveBeenCalled();
  expect(load.mock.calls[0][0].aborted).toBe(true);
  await press('오늘 밤 양 세러 가기');
  await tick();
  await act(async () =>
    wait.resolve({
      server_time: '2026-11-16T19:00:00Z',
      closes_at: '2026-11-16T19:00:00Z',
      closed: true,
    }),
  );
  expect(screen.getByText('2 / 5')).toBeTruthy();
  expect(screen.queryByText('밤이 끝났어요')).toBeNull();
});

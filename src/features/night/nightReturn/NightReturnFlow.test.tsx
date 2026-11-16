import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { NightReturnFlow } from './NightReturnFlow';
import { createMockNightReturn } from '../../../mocks/nightReturn';
import { snapshot, lastSession } from './__tests__/fixture';
import { deferred } from '../../../notifications/__tests__/fakeDevice';
import type { ReturnBootstrap, NightReturnActions } from './model';
const tick = () =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(1000);
  });
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
async function fixture(
  preset: Parameters<typeof createMockNightReturn>[0] = 'completed',
) {
  const actions = createMockNightReturn(preset),
    restart = jest.fn(),
    navigate = jest.fn(),
    exit = jest.fn();
  const load = jest.spyOn(actions, 'load');
  await render(
    <NightReturnFlow
      actions={actions}
      onRestart={restart}
      onNavigate={navigate}
      onExit={exit}
    />,
  );
  await tick();
  return { actions, restart, navigate, exit, load };
}
it('rechecks once before forwarding a selected count and never forwards it twice', async () => {
  const f = await fixture();
  await fireEvent.press(screen.getByRole('radio', { name: '10마리' }));
  await press('10마리 더 세기');
  expect(
    screen.getByRole('button', { name: '밤 상태 확인 중' }),
  ).toBeDisabled();
  await press('밤 상태 확인 중');
  await tick();
  expect(f.load).toHaveBeenCalledTimes(2);
  expect(f.restart).toHaveBeenCalledTimes(1);
  expect(f.restart).toHaveBeenCalledWith({
    nightId: 'return-night',
    count: 10,
  });
  expect(f.navigate).not.toHaveBeenCalled();
  const other = jest.fn();
  await screen.rerender(
    <NightReturnFlow
      actions={f.actions}
      onRestart={other}
      onNavigate={f.navigate}
      onExit={f.exit}
    />,
  );
  expect(other).not.toHaveBeenCalled();
});
it('rests locally without requesting another bootstrap or a restart', async () => {
  const f = await fixture();
  await press('그냥 누워 있을게요');
  await press('그냥 누워 있을게요');
  expect(f.exit).toHaveBeenCalledTimes(1);
  expect(f.load).toHaveBeenCalledTimes(1);
  expect(f.restart).not.toHaveBeenCalled();
});
it('recovers an initial read failure without treating it as a restart intent', async () => {
  const f = await fixture('initial-error');
  expect(screen.getByText('밤 기록을 불러오지 못했어요')).toBeTruthy();
  await press('다시 불러오기');
  await tick();
  expect(screen.getByRole('button', { name: '5마리 더 세기' })).toBeTruthy();
  expect(f.restart).not.toHaveBeenCalled();
});
it('retains the original quick selection while retrying a failed confirmation read', async () => {
  const f = await fixture('retry');
  await fireEvent.press(screen.getByRole('radio', { name: '3마리' }));
  await press('3마리 더 세기');
  await tick();
  expect(screen.getByText('밤 상태를 확인하지 못했어요')).toBeTruthy();
  expect(screen.getByRole('radio', { name: '3마리' })).toBeChecked();
  expect(f.restart).not.toHaveBeenCalled();
  await press('다시 확인');
  await tick();
  expect(f.load).toHaveBeenCalledTimes(3);
  expect(f.restart).toHaveBeenCalledWith({ nightId: 'return-night', count: 3 });
});
it.each([
  ['expired-on-check', { kind: 'morning', nightId: 'return-night' }],
  [
    'active-on-check',
    { kind: 'feed', nightId: 'return-night', sessionId: 'return-active' },
  ],
  ['closing', { kind: 'closing', nightId: 'return-night' }],
  ['support', { kind: 'support', nightId: 'return-night' }],
] as const)(
  'respects %s instead of restarting from an old record',
  async (preset, want) => {
    const f = await fixture(preset);
    if (preset.endsWith('on-check')) {
      await press('5마리 더 세기');
      await tick();
    }
    expect(f.navigate).toHaveBeenCalledWith(want);
    expect(f.restart).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: '5마리 더 세기' })).toBeNull();
  },
);
it('requires a fresh choice when the confirmed last-session record has changed', async () => {
  const f = await fixture('changed');
  await fireEvent.press(screen.getByRole('radio', { name: '10마리' }));
  await press('10마리 더 세기');
  await tick();
  expect(screen.getByText('01:30에 20마리 다 셌어요')).toBeTruthy();
  expect(screen.getByRole('radio', { name: '5마리' })).toBeChecked();
  expect(f.restart).not.toHaveBeenCalled();
  await press('5마리 더 세기');
  await tick();
  expect(f.restart).toHaveBeenCalledWith({ nightId: 'return-night', count: 5 });
});
it('aborts a pending confirmation on rest and ignores its late result', async () => {
  const late = deferred<ReturnBootstrap>();
  const load = jest
    .fn<NightReturnActions['load']>()
    .mockResolvedValueOnce(snapshot())
    .mockImplementationOnce(() => late.promise);
  const actions = { load },
    restart = jest.fn(),
    navigate = jest.fn(),
    exit = jest.fn();
  await render(
    <NightReturnFlow
      actions={actions}
      onRestart={restart}
      onNavigate={navigate}
      onExit={exit}
    />,
  );
  await press('5마리 더 세기');
  await press('그냥 누워 있을게요');
  expect(load.mock.calls[1][0].aborted).toBe(true);
  expect(exit).toHaveBeenCalledTimes(1);
  await act(async () => late.resolve(snapshot()));
  expect(restart).not.toHaveBeenCalled();
  expect(navigate).not.toHaveBeenCalled();
});
it('isolates an old pending selection and receipt when the actions source changes', async () => {
  const late = deferred<ReturnBootstrap>(),
    first = {
      load: jest
        .fn<NightReturnActions['load']>()
        .mockResolvedValueOnce(snapshot())
        .mockImplementationOnce(() => late.promise),
    };
  const second = {
      load: jest.fn<NightReturnActions['load']>().mockResolvedValue(
        snapshot({
          night_id: 'second-night',
          last_session: lastSession({ counted: 20 }),
        }),
      ),
    },
    restart = jest.fn();
  const view = (actions: NightReturnActions) => (
    <NightReturnFlow
      actions={actions}
      onRestart={restart}
      onNavigate={() => {}}
      onExit={() => {}}
    />
  );
  await render(view(first));
  await fireEvent.press(screen.getByRole('radio', { name: '10마리' }));
  await press('10마리 더 세기');
  await screen.rerender(view(second));
  expect(first.load.mock.calls[1][0].aborted).toBe(true);
  await act(async () => late.resolve(snapshot()));
  expect(screen.getByText('01:12에 20마리 다 셌어요')).toBeTruthy();
  expect(restart).not.toHaveBeenCalled();
  await press('5마리 더 세기');
  expect(restart).toHaveBeenCalledWith({ nightId: 'second-night', count: 5 });
});

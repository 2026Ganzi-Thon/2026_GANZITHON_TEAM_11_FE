import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { ReceivedYarnSection } from './ReceivedYarnSection';
import { createReceivedYarnController } from './controller';
import { createMockReceivedYarn } from '../../mocks/receivedYarn';
import type { ReceivedYarnActions, ReceivedYarnSummary } from './types';
import { deferred } from '../../notifications/__tests__/fakeDevice';
const summary = {
  id: 'today',
  date: '2026-11-17',
  yarn_count: 3,
  sender_count: 2,
};
const tick = () =>
  act(async () => {
    await jest.runAllTimersAsync();
  });
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
it('reopens a seen summary through a separate manual read after home remount without showing it automatically', async () => {
  jest.useFakeTimers();
  const actions = createMockReceivedYarn();
  let c = createReceivedYarnController(actions);
  c.start();
  await jest.runAllTimersAsync();
  c.shown();
  await jest.runAllTimersAsync();
  c.dismiss();
  c.stop();
  c = createReceivedYarnController(actions);
  c.start();
  await jest.runAllTimersAsync();
  expect(c.getSnapshot().visible).toBe(false);
  c.open();
  await jest.runAllTimersAsync();
  expect(c.getSnapshot()).toMatchObject({
    visible: true,
    summary: { yarn_count: 3 },
  });
  c.stop();
});
it('retries the failed manual operation and blocks duplicate or hidden reads', async () => {
  const pending = deferred<ReceivedYarnSummary | null>();
  const latest = jest
    .fn<NonNullable<ReceivedYarnActions['loadLatest']>>()
    .mockRejectedValueOnce(new Error('private'))
    .mockImplementationOnce(() => pending.promise);
  const markSeen = jest.fn<ReceivedYarnActions['markSeen']>(async () => {});
  const c = createReceivedYarnController({
    load: async () => null,
    loadLatest: latest,
    markSeen,
  });
  c.start();
  await Promise.resolve();
  await Promise.resolve();
  c.block(true);
  c.open();
  expect(latest).not.toHaveBeenCalled();
  c.block(false);
  c.open();
  await Promise.resolve();
  await Promise.resolve();
  expect(c.getSnapshot().phase).toBe('error');
  c.retryLoad();
  c.open();
  expect(latest).toHaveBeenCalledTimes(2);
  pending.resolve(summary);
  await Promise.resolve();
  await Promise.resolve();
  expect(c.getSnapshot().summary).toEqual(summary);
  expect(markSeen).not.toHaveBeenCalled();
  c.shown();
  await Promise.resolve();
  await Promise.resolve();
  expect(markSeen).toHaveBeenCalledWith('today', expect.any(AbortSignal));
  c.stop();
});
it('aborts a manual read on stop and ignores its late completion', async () => {
  const late = deferred<ReceivedYarnSummary | null>();
  const latest = jest.fn<NonNullable<ReceivedYarnActions['loadLatest']>>(
    () => late.promise,
  );
  const c = createReceivedYarnController({
    load: async () => null,
    loadLatest: latest,
    markSeen: async () => {},
  });
  c.start();
  await Promise.resolve();
  await Promise.resolve();
  c.open();
  c.stop();
  expect(latest.mock.calls[0][0].aborted).toBe(true);
  late.resolve(summary);
  await Promise.resolve();
  await Promise.resolve();
  expect(c.getSnapshot().visible).toBe(false);
});
it('shows an empty result after pressing the bell without inventing an automatic popup', async () => {
  jest.useFakeTimers();
  const previous = Object.getOwnPropertyDescriptor(AppState, 'currentState');
  Object.defineProperty(AppState, 'currentState', {
    value: 'active',
    configurable: true,
  });
  try {
    await render(
      <ReceivedYarnSection actions={createMockReceivedYarn('none')} />,
    );
    await tick();
    expect(screen.queryByText('아직 도착한 털실이 없어요')).toBeNull();
    await fireEvent.press(
      screen.getByRole('button', { name: '받은 털실 알림 열기' }),
    );
    await tick();
    expect(screen.getByText('아직 도착한 털실이 없어요')).toBeTruthy();
    expect(screen.queryByTestId('received-yarn-modal')).toBeNull();
  } finally {
    if (previous) Object.defineProperty(AppState, 'currentState', previous);
  }
});

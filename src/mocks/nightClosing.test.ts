import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { createMockNightClosing } from './nightClosing';
const request = {
  reason: 'leave' as const,
  position: 2,
  furthestPosition: 3,
  sheepCount: 6,
};
afterEach(() => {
  jest.useRealTimers();
});
async function settle<T>(promise: Promise<T>) {
  const outcome = promise.then(
    (value) => ({ value }),
    (error) => ({ error }),
  );
  await jest.runAllTimersAsync();
  return outcome;
}
describe('closing preview adapter', () => {
  it('replays a committed finish after a lost response and rejects a different payload with the same key', async () => {
    jest.useFakeTimers();
    const actions = createMockNightClosing('finish-lost');
    const signal = new AbortController().signal;
    expect(
      await settle(actions.finish(request, 'finish-1', signal)),
    ).toHaveProperty('error');
    const replay = await settle(actions.finish(request, 'finish-1', signal));
    expect(replay).toHaveProperty('value.summary.counted', 3);
    expect(await settle(actions.finish(request, 'finish-1', signal))).toEqual(
      replay,
    );
    expect(
      await settle(
        actions.finish({ ...request, position: 1 }, 'finish-1', signal),
      ),
    ).toHaveProperty('error');
  });
  it('cancels pending work and removes its timer and listener', async () => {
    jest.useFakeTimers();
    const controller = new AbortController();
    const remove = jest.spyOn(controller.signal, 'removeEventListener');
    const promise = createMockNightClosing().finish(
      request,
      'f',
      controller.signal,
    );
    const outcome = promise.catch((error) => error);
    controller.abort();
    expect(await outcome).toMatchObject({ kind: 'aborted' });
    expect(jest.getTimerCount()).toBe(0);
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  });
  it('requires the final position for completion and does not generate another card for a completed feed', async () => {
    jest.useFakeTimers();
    const actions = createMockNightClosing();
    const signal = new AbortController().signal;
    expect(
      await settle(
        actions.finish({ ...request, reason: 'completed' }, 'f', signal),
      ),
    ).toHaveProperty('error');
    expect(
      await settle(
        actions.finish(
          { ...request, reason: 'completed', position: 6, furthestPosition: 6 },
          'ok',
          signal,
        ),
      ),
    ).toHaveProperty('value.closing_card', null);
  });
});

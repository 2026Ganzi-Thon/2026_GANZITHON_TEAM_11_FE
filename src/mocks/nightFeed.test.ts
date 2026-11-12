import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { createMockNightFeed } from './nightFeed';
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});
describe('preview feed loader', () => {
  it.each([3, 30])(
    'returns the selected %i slots with distinct IDs and a final warm card',
    async (count) => {
      const p = createMockNightFeed(count)(new AbortController().signal);
      await jest.advanceTimersByTimeAsync(800);
      const cards = await p;
      expect(cards).toHaveLength(count);
      expect(new Set(cards.map((c) => c.id)).size).toBe(count);
      expect(cards.at(-1)?.tone).toBe('warm');
    },
  );
  it('rejects invalid counts before creating a feed', () => {
    for (const count of [2, 31, 3.5, NaN])
      expect(() => createMockNightFeed(count)).toThrow();
  });
  it('fails once, then succeeds on retry', async () => {
    const load = createMockNightFeed(3, 'retry');
    const failure = expect(
      load(new AbortController().signal),
    ).rejects.toMatchObject({ kind: 'network' });
    await jest.advanceTimersByTimeAsync(800);
    await failure;
    const p = load(new AbortController().signal);
    await jest.advanceTimersByTimeAsync(800);
    expect(await p).toHaveLength(3);
  });
  it('cleans timers/listeners on abort and rejects already aborted work', async () => {
    const load = createMockNightFeed(3);
    const controller = new AbortController();
    const remove = jest.spyOn(controller.signal, 'removeEventListener');
    const failure = expect(load(controller.signal)).rejects.toMatchObject({
      kind: 'aborted',
    });
    controller.abort();
    await failure;
    expect(jest.getTimerCount()).toBe(0);
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    await expect(load(controller.signal)).rejects.toMatchObject({
      kind: 'aborted',
    });
  });
});

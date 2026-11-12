import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { createMockNightEntry } from './nightEntry';

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});
const draft = { category_id: 'none', worry_text: null } as const;

describe('night entry mock lifecycle', () => {
  it('delays successful responses and removes its timer and listener', async () => {
    const signal = new AbortController().signal;
    const remove = jest.spyOn(signal, 'removeEventListener');
    const mock = createMockNightEntry('success');
    const operation = mock.checkWorry(draft, signal);
    expect(jest.getTimerCount()).toBe(1);
    await jest.advanceTimersByTimeAsync(800);
    await expect(operation).resolves.toBeUndefined();
    expect(jest.getTimerCount()).toBe(0);
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  });
  it.each(['worry-retry', 'count-retry'] as const)(
    'fails once then allows an actual retry: %s',
    async (scenario) => {
      const mock = createMockNightEntry(scenario);
      const signal = new AbortController().signal;
      const invoke = () =>
        scenario === 'worry-retry'
          ? mock.checkWorry(draft, signal)
          : mock.startCounting(15, signal);
      const failed = expect(invoke()).rejects.toMatchObject({
        kind: 'network',
      });
      await jest.advanceTimersByTimeAsync(800);
      await failed;
      const succeeded = expect(invoke()).resolves.toBeUndefined();
      await jest.advanceTimersByTimeAsync(800);
      await succeeded;
      expect(jest.getTimerCount()).toBe(0);
    },
  );
  it('rejects pre-aborted and in-flight requests, without consuming the failure scenario', async () => {
    const mock = createMockNightEntry('worry-retry');
    const before = new AbortController();
    before.abort();
    await expect(mock.checkWorry(draft, before.signal)).rejects.toMatchObject({
      kind: 'aborted',
    });
    expect(jest.getTimerCount()).toBe(0);
    const active = new AbortController();
    const remove = jest.spyOn(active.signal, 'removeEventListener');
    const pending = expect(
      mock.checkWorry(draft, active.signal),
    ).rejects.toMatchObject({ kind: 'aborted' });
    active.abort();
    await pending;
    expect(jest.getTimerCount()).toBe(0);
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    const failed = expect(
      mock.checkWorry(draft, new AbortController().signal),
    ).rejects.toMatchObject({ kind: 'network' });
    await jest.advanceTimersByTimeAsync(800);
    await failed;
  });
});

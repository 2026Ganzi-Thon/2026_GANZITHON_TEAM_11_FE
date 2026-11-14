import { expect, it, jest, afterEach } from '@jest/globals';
import { createWorryDeletions, type WorryDeletionActions } from './deletions';
import { createMockWorryDeletion } from '../../mocks/worryDeletion';
const signal = () => new AbortController().signal;
afterEach(() => {
  jest.useRealTimers();
});
it('publishes only confirmed void results, is idempotent and isolates sources', async () => {
  const remove = jest
    .fn<WorryDeletionActions['remove']>()
    .mockRejectedValueOnce(new Error('network'))
    .mockResolvedValue(undefined);
  const source = createWorryDeletions({ remove });
  const other = createWorryDeletions({ remove });
  const listener = jest.fn();
  const unsubscribe = source.subscribe(listener);
  await expect(source.remove('a', signal())).rejects.toThrow();
  expect(source.isDeleted('a')).toBe(false);
  expect(listener).not.toHaveBeenCalled();
  await source.remove('a', signal());
  await source.remove('a', signal());
  expect(listener).toHaveBeenCalledTimes(1);
  expect(listener).toHaveBeenCalledWith('a');
  expect(source.isDeleted('b')).toBe(false);
  expect(other.isDeleted('a')).toBe(false);
  unsubscribe();
  await source.remove('b', signal());
  expect(listener).toHaveBeenCalledTimes(1);
});
it('rejects malformed success and empty IDs without publishing deletion', async () => {
  const remove = jest
    .fn<WorryDeletionActions['remove']>()
    .mockResolvedValue({} as never);
  const source = createWorryDeletions({ remove });
  await expect(source.remove(' ', signal())).rejects.toMatchObject({
    kind: 'configuration',
  });
  expect(remove).not.toHaveBeenCalled();
  await expect(source.remove('a', signal())).rejects.toMatchObject({
    kind: 'invalid-response',
  });
  expect(source.isDeleted('a')).toBe(false);
});
it('does not publish a successful late completion after cancellation', async () => {
  let finish!: () => void;
  const remove = jest.fn<WorryDeletionActions['remove']>().mockImplementation(
    () =>
      new Promise<void>((r) => {
        finish = r;
      }),
  );
  const source = createWorryDeletions({ remove });
  const controller = new AbortController();
  const pending = source.remove('a', controller.signal);
  const rejected = expect(pending).rejects.toMatchObject({ kind: 'aborted' });
  controller.abort();
  finish();
  await rejected;
  expect(source.isDeleted('a')).toBe(false);
  await expect(source.remove('a', controller.signal)).rejects.toMatchObject({
    kind: 'aborted',
  });
  expect(remove).toHaveBeenCalledTimes(1);
});
it.each(['success', 'abort'] as const)(
  'cleans the mock timer/listener on %s',
  async (completion) => {
    jest.useFakeTimers();
    const erase = jest.fn();
    const source = createMockWorryDeletion(erase, 'slow');
    const controller = new AbortController();
    const listener = jest.spyOn(controller.signal, 'removeEventListener');
    const pending = source.remove('a', controller.signal);
    if (completion === 'abort') {
      const rejected = expect(pending).rejects.toMatchObject({
        kind: 'aborted',
      });
      controller.abort();
      await rejected;
    } else {
      await jest.runAllTimersAsync();
      await pending;
    }
    expect(jest.getTimerCount()).toBe(0);
    expect(listener).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(erase).toHaveBeenCalledTimes(completion === 'abort' ? 0 : 1);
  },
);

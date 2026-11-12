import { afterEach, expect, it, jest } from '@jest/globals';
import type { Card } from '../../api/contracts';
import { ApiError } from '../../api/errors';
import { createFluffController } from './controller';
import type { FluffActions } from './types';
const card = (id = 'a', saved = false): Card => ({
  id,
  kind: 'text',
  tone: 'empathy',
  category_id: null,
  author_type: 'seed',
  author_label: '먼저 지나간 양',
  available: true,
  content: { text: '쉬어 가도 괜찮아.' },
  viewer: { yarn_sent: false, fluff_saved: saved, song_saved: false },
});
function deferred() {
  let resolve!: (v: { card_id: string; saved: boolean }) => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<{ card_id: string; saved: boolean }>((r, j) => {
    resolve = r;
    reject = j;
  });
  return { promise, resolve, reject };
}
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
afterEach(() => {
  jest.useRealTimers();
});
it('keeps confirmed selection while serializing the final attach/remove target', async () => {
  const a = deferred(),
    b = deferred();
  const set = jest
    .fn<FluffActions['set']>()
    .mockReturnValueOnce(a.promise)
    .mockReturnValueOnce(b.promise);
  const c = createFluffController({ set }),
    first = card();
  c.toggle(first);
  c.toggle(first);
  expect(c.hasPending()).toBe(true);
  expect(c.stateFor(first)).toMatchObject({
    saved: false,
    target: false,
    pending: true,
  });
  a.resolve({ card_id: 'a', saved: true });
  await flush();
  expect(set.mock.calls.map((call) => call[1])).toEqual([true, false]);
  expect(c.stateFor(first)).toMatchObject({
    saved: true,
    target: false,
    pending: true,
    notice: null,
  });
  b.resolve({ card_id: 'a', saved: false });
  await flush();
  expect(c.stateFor(first)).toMatchObject({
    saved: false,
    pending: false,
    notice: 'removed',
  });
  expect(c.hasPending()).toBe(false);
  c.stop();
});
it('coalesces three rapid changes and keeps concurrent cards independent', async () => {
  const a = deferred(),
    b = deferred();
  const set = jest
    .fn<FluffActions['set']>()
    .mockReturnValueOnce(a.promise)
    .mockReturnValueOnce(b.promise);
  const c = createFluffController({ set }),
    first = card(),
    second = card('b');
  c.toggle(first);
  c.toggle(first);
  c.toggle(first);
  c.toggle(second);
  a.resolve({ card_id: 'a', saved: true });
  await flush();
  expect(c.stateFor(first)).toMatchObject({ saved: true, pending: false });
  expect(c.stateFor(second)).toMatchObject({
    saved: false,
    pending: true,
    notice: null,
  });
  b.reject(new ApiError('network'));
  await flush();
  expect(set).toHaveBeenCalledTimes(2);
  expect(c.stateFor(second).error).toBe('failed');
  c.stop();
});
it('retries an uncertain final false even when the last confirmed state was false', async () => {
  const a = deferred();
  const set = jest
    .fn<FluffActions['set']>()
    .mockReturnValueOnce(a.promise)
    .mockResolvedValue({ card_id: 'a', saved: false });
  const c = createFluffController({ set }),
    first = card();
  c.toggle(first);
  c.toggle(first);
  a.reject(new ApiError('network'));
  await flush();
  expect(c.stateFor(first)).toMatchObject({
    saved: false,
    target: false,
    error: 'failed',
  });
  c.retry(first);
  await flush();
  expect(set.mock.calls.map((call) => call[1])).toEqual([true, false]);
  expect(c.stateFor(first)).toMatchObject({
    saved: false,
    error: null,
    notice: 'removed',
  });
  c.stop();
});
it.each([
  { card_id: 'other', saved: true },
  { card_id: 'a', saved: false },
])('rejects an inconsistent reply %j', async (reply) => {
  const c = createFluffController({ set: async () => reply }),
    first = card();
  c.toggle(first);
  await flush();
  expect(c.stateFor(first)).toMatchObject({
    saved: false,
    error: 'failed',
    notice: null,
  });
  c.stop();
});
it('hides unavailable cards without treating a profile 403 as deletion', async () => {
  const set = jest
    .fn<FluffActions['set']>()
    .mockRejectedValueOnce(
      new ApiError('http', { status: 409, code: 'CARD_UNAVAILABLE' }),
    )
    .mockRejectedValueOnce(new ApiError('http', { status: 403 }));
  const c = createFluffController({ set }),
    a = card(),
    b = card('b');
  c.toggle(a);
  await flush();
  c.toggle(a);
  c.retry(a);
  c.toggle(b);
  await flush();
  expect(c.stateFor(a).error).toBe('unavailable');
  expect(c.stateFor(b).error).toBe('failed');
  expect(set).toHaveBeenCalledTimes(2);
  c.stop();
});
it('closes the entire night, aborts other cards, ignores late replies and prevents further retry', async () => {
  const a = deferred(),
    b = deferred();
  const set = jest
    .fn<FluffActions['set']>()
    .mockReturnValueOnce(a.promise)
    .mockReturnValueOnce(b.promise);
  const c = createFluffController({ set }),
    first = card(),
    second = card('b', true);
  c.toggle(first);
  c.toggle(second);
  a.reject(new ApiError('http', { status: 409, code: 'NIGHT_CLOSED' }));
  await flush();
  expect(c.isClosed()).toBe(true);
  expect(c.hasPending()).toBe(false);
  expect(set.mock.calls[1][2].aborted).toBe(true);
  b.resolve({ card_id: 'b', saved: false });
  await flush();
  expect(c.stateFor(second)).toMatchObject({
    saved: true,
    error: 'closed',
    notice: null,
  });
  expect(c.stateFor(card('unvisited')).error).toBe('closed');
  c.toggle(first);
  c.retry(second);
  expect(set).toHaveBeenCalledTimes(2);
  c.stop();
});
it('stops requests and notice timers, ignores late completion and supports remount start', async () => {
  jest.useFakeTimers();
  const a = deferred();
  const set = jest
    .fn<FluffActions['set']>()
    .mockReturnValueOnce(a.promise)
    .mockResolvedValue({ card_id: 'b', saved: true });
  const c = createFluffController({ set }),
    first = card();
  c.toggle(first);
  c.stop();
  c.start();
  a.resolve({ card_id: 'a', saved: true });
  await flush();
  expect(c.stateFor(first)).toMatchObject({
    saved: false,
    pending: false,
    notice: null,
  });
  const listener = jest.fn(),
    unsub = c.subscribe(listener);
  c.toggle(card('b'));
  await flush();
  expect(jest.getTimerCount()).toBe(1);
  unsub();
  const calls = listener.mock.calls.length;
  c.stop();
  expect(jest.getTimerCount()).toBe(0);
  expect(listener).toHaveBeenCalledTimes(calls);
});

import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { ApiError } from '../../api/errors';
import type { Card } from '../../api/contracts';
import type { YarnActions, YarnResult } from './types';
import { createYarnController } from './controller';
const card = (id = 'c1', sent = false): Card => ({
  id,
  kind: 'text',
  tone: 'empathy',
  category_id: 'career',
  author_type: 'user',
  author_label: '먼저 지나간 양',
  available: true,
  content: { text: '쉬어 가도 괜찮아요.' },
  viewer: { yarn_sent: sent, fluff_saved: false, song_saved: false },
});
function deferred() {
  let resolve!: (r: YarnResult) => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<YarnResult>((r, j) => {
    resolve = r;
    reject = j;
  });
  return { promise, resolve, reject };
}
async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}
afterEach(() => {
  jest.useRealTimers();
});
describe('feed-owned yarn state', () => {
  it('keeps confirmation separate from a pending intent and coalesces send/cancel/send', async () => {
    const job = deferred();
    const set = jest.fn<YarnActions['set']>().mockReturnValue(job.promise);
    const c = createYarnController({ set });
    const first = card();
    c.toggle(first);
    expect(c.stateFor(first)).toMatchObject({
      sent: false,
      target: true,
      pending: true,
      notice: null,
    });
    c.toggle(first);
    c.toggle(first);
    expect(set).toHaveBeenCalledTimes(1);
    job.resolve({ card_id: first.id, sent: true });
    await flush();
    expect(c.stateFor(first)).toMatchObject({
      sent: true,
      target: true,
      pending: false,
      notice: 'sent',
    });
    expect(set).toHaveBeenCalledTimes(1);
    c.stop();
  });
  it('serializes send then cancel and never claims completion for an intermediate result', async () => {
    const a = deferred(),
      b = deferred();
    const set = jest
      .fn<YarnActions['set']>()
      .mockReturnValueOnce(a.promise)
      .mockReturnValueOnce(b.promise);
    const c = createYarnController({ set });
    const first = card();
    c.toggle(first);
    c.toggle(first);
    a.resolve({ card_id: 'c1', sent: true });
    await flush();
    expect(set.mock.calls.map((x) => x[1])).toEqual([true, false]);
    expect(c.stateFor(first)).toMatchObject({
      sent: true,
      target: false,
      pending: true,
      notice: null,
    });
    b.resolve({ card_id: 'c1', sent: false });
    await flush();
    expect(c.stateFor(first)).toMatchObject({
      sent: false,
      target: false,
      pending: false,
      notice: 'removed',
    });
    c.stop();
  });
  it('keeps offscreen state and isolates simultaneous requests by card id', async () => {
    const a = deferred(),
      b = deferred();
    const set = jest
      .fn<YarnActions['set']>()
      .mockReturnValueOnce(a.promise)
      .mockReturnValueOnce(b.promise);
    const c = createYarnController({ set });
    const first = card(),
      second = card('c2');
    c.toggle(first);
    c.toggle(second);
    a.resolve({ card_id: 'c1', sent: true });
    await flush();
    expect(c.stateFor(second)).toMatchObject({
      sent: false,
      pending: true,
      notice: null,
    });
    b.reject(new ApiError('network'));
    await flush();
    expect(c.stateFor(first)).toMatchObject({
      sent: true,
      pending: false,
      error: null,
    });
    expect(c.stateFor(second)).toMatchObject({ sent: false, error: 'failed' });
    c.stop();
  });
  it('retries the final false intent after a failed send even if last confirmed was false', async () => {
    const a = deferred();
    const set = jest
      .fn<YarnActions['set']>()
      .mockReturnValueOnce(a.promise)
      .mockResolvedValue({ card_id: 'c1', sent: false });
    const c = createYarnController({ set });
    const first = card();
    c.toggle(first);
    c.toggle(first);
    a.reject(new ApiError('network'));
    await flush();
    expect(c.stateFor(first)).toMatchObject({
      sent: false,
      target: false,
      error: 'failed',
      pending: false,
    });
    c.retry(first);
    await flush();
    expect(set.mock.calls.map((x) => x[1])).toEqual([true, false]);
    expect(c.stateFor(first)).toMatchObject({
      sent: false,
      error: null,
      notice: 'removed',
    });
    c.stop();
  });
  it.each([
    { card_id: 'other', sent: true },
    { card_id: 'c1', sent: false },
  ])('rejects a mismatched response %j', async (reply) => {
    const set = jest.fn<YarnActions['set']>().mockResolvedValue(reply);
    const c = createYarnController({ set });
    const first = card();
    c.toggle(first);
    await flush();
    expect(c.stateFor(first)).toMatchObject({
      sent: false,
      target: true,
      pending: false,
      error: 'failed',
      notice: null,
    });
    c.stop();
  });
  it('marks unavailable content and prevents subsequent reactions', async () => {
    const set = jest
      .fn<YarnActions['set']>()
      .mockRejectedValue(
        new ApiError('http', { status: 409, code: 'CARD_UNAVAILABLE' }),
      );
    const c = createYarnController({ set });
    const first = card();
    c.toggle(first);
    await flush();
    expect(c.stateFor(first).error).toBe('unavailable');
    c.toggle(first);
    c.retry(first);
    expect(set).toHaveBeenCalledTimes(1);
    c.stop();
  });
  it('cancels on explicit stop, ignores late completion and never launches queued work', async () => {
    const a = deferred();
    const set = jest.fn<YarnActions['set']>().mockReturnValue(a.promise);
    const c = createYarnController({ set });
    const first = card();
    c.toggle(first);
    c.toggle(first);
    c.stop();
    expect(set.mock.calls[0][2].aborted).toBe(true);
    a.resolve({ card_id: 'c1', sent: true });
    await flush();
    expect(set).toHaveBeenCalledTimes(1);
    expect(c.stateFor(first)).toMatchObject({
      sent: false,
      pending: false,
      notice: null,
    });
    c.toggle(first);
    expect(set).toHaveBeenCalledTimes(1);
  });
  it('cleans notice timers and subscriptions; restarting supports strict-mode remounts', async () => {
    jest.useFakeTimers();
    const set = jest
      .fn<YarnActions['set']>()
      .mockResolvedValue({ card_id: 'c1', sent: true });
    const c = createYarnController({ set });
    const first = card();
    const listener = jest.fn();
    const unsubscribe = c.subscribe(listener);
    c.toggle(first);
    await flush();
    expect(c.stateFor(first).notice).toBe('sent');
    expect(jest.getTimerCount()).toBe(1);
    unsubscribe();
    const count = listener.mock.calls.length;
    await jest.advanceTimersByTimeAsync(5000);
    expect(c.stateFor(first).notice).toBeNull();
    expect(listener).toHaveBeenCalledTimes(count);
    c.stop();
    expect(jest.getTimerCount()).toBe(0);
    c.start();
    const second = card('c2');
    c.toggle(second);
    expect(set).toHaveBeenCalledTimes(2);
    c.stop();
  });
  it('does not react to an already unavailable or empty card', () => {
    const set = jest.fn<YarnActions['set']>();
    const c = createYarnController({ set });
    c.toggle({ ...card(), available: false });
    c.toggle({ ...card('c2'), content: null });
    expect(set).not.toHaveBeenCalled();
    c.stop();
  });
  it('does not treat a consent/profile 403 as a deleted card', async () => {
    const set = jest
      .fn<YarnActions['set']>()
      .mockRejectedValue(new ApiError('http', { status: 403 }));
    const c = createYarnController({ set });
    const first = card();
    c.toggle(first);
    await flush();
    expect(c.stateFor(first)).toMatchObject({ sent: false, error: 'failed' });
    c.stop();
  });
});

import { expect, it, jest } from '@jest/globals';
import { createWorrySelectionController } from './selectionDeletion';
import type { RecordDeletions } from './recordDeletion';
function port() {
  const deleted = new Set<string>(),
    confirmed = new Set<string>();
  return {
    isDeleted: (id: string) => confirmed.has(id),
    remove: jest
      .fn<RecordDeletions['remove']>()
      .mockImplementation(async (id) => {
        deleted.add(id);
        confirmed.add(id);
      }),
    check: jest
      .fn<RecordDeletions['check']>()
      .mockImplementation(async (id) => {
        if (deleted.has(id)) confirmed.add(id);
        return deleted.has(id);
      }),
    deleted,
  };
}
it('keeps partial success and retries only a confirmed surviving record', async () => {
  const p = port();
  const original = p.remove.getMockImplementation()!;
  let failed = false;
  p.remove.mockImplementation(async (id, signal) => {
    if (id === 'b' && !failed) {
      failed = true;
      throw Error('network');
    }
    await original(id, signal);
  });
  const c = createWorrySelectionController(p);
  await c.start(['a', 'b']);
  expect(c.getSnapshot().items.map((x) => x.status)).toEqual([
    'done',
    'failed',
  ]);
  await c.retry();
  expect(p.remove.mock.calls.map((x) => x[0])).toEqual(['a', 'b', 'b']);
  expect(c.getSnapshot().items.map((x) => x.status)).toEqual(['done', 'done']);
});
it('preserves unknown results across leaving and reentry and only looks them up on retry', async () => {
  const p = port();
  p.remove.mockImplementation(async (id) => {
    p.deleted.add(id);
    throw Error('lost');
  });
  p.check.mockRejectedValueOnce(Error('offline'));
  const c = createWorrySelectionController(p);
  await c.start(['a']);
  expect(c.getSnapshot().items[0].status).toBe('unknown');
  const leave = c.subscribe(() => {});
  leave();
  const back = c.subscribe(() => {});
  await c.retry();
  expect(c.getSnapshot().items[0].status).toBe('done');
  expect(p.remove).toHaveBeenCalledTimes(1);
  expect(p.check).toHaveBeenCalledTimes(2);
  back();
});
it('pauses a request on last subscriber departure and ignores a late result', async () => {
  const p = port();
  let finish!: () => void;
  p.remove.mockImplementationOnce(
    () =>
      new Promise((r) => {
        finish = r;
      }),
  );
  const c = createWorrySelectionController(p),
    leave = c.subscribe(() => {});
  const request = c.start(['a', 'b']);
  const signal = p.remove.mock.calls[0][1];
  leave();
  expect(signal.aborted).toBe(true);
  expect(c.getSnapshot().items.map((x) => x.status)).toEqual([
    'unknown',
    'failed',
  ]);
  finish();
  await request;
  expect(c.getSnapshot().items[0].status).toBe('unknown');
  expect(p.remove).toHaveBeenCalledTimes(1);
});
it('freezes targets, blocks duplicate runs and refuses to discard unconfirmed results', async () => {
  const p = port();
  let finish!: () => void;
  p.remove.mockImplementationOnce(
    () =>
      new Promise((r) => {
        finish = r;
      }),
  );
  const c = createWorrySelectionController(p),
    ids = ['a'];
  const request = c.start(ids);
  ids.push('b');
  await c.start(['c']);
  await c.retry();
  expect(p.remove).toHaveBeenCalledTimes(1);
  expect(c.getSnapshot().items.map((x) => x.nightId)).toEqual(['a']);
  c.pause();
  c.reset();
  expect(c.getSnapshot().items[0].status).toBe('unknown');
  finish();
  await request;
});
it('checks an uncertain surviving record without deleting until the next explicit retry', async () => {
  const p = port();
  p.remove.mockRejectedValueOnce(Error('unconfirmed'));
  p.check.mockRejectedValueOnce(Error('lookup unavailable'));
  const c = createWorrySelectionController(p);
  await c.start(['a']);
  await c.retry();
  expect(c.getSnapshot().items[0].status).toBe('failed');
  expect(p.remove).toHaveBeenCalledTimes(1);
  await c.retry();
  expect(p.remove).toHaveBeenCalledTimes(2);
  expect(c.getSnapshot().items[0].status).toBe('done');
});

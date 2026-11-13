import { afterEach, expect, it, jest } from '@jest/globals';
import { createMockMyCards } from './myCards';

afterEach(() => {
  jest.useRealTimers();
});
async function wait<T>(job: Promise<T>) {
  await jest.runAllTimersAsync();
  return job;
}
it('pages a stable ordered list and filters before paginating', async () => {
  jest.useFakeTimers();
  const actions = createMockMyCards();
  const first = await wait(actions.load({}, new AbortController().signal));
  expect(first.items.map((card) => card.id)).toEqual([
    'my-text-1',
    'my-song-2',
    'my-text-3',
  ]);
  const next = await wait(
    actions.load({ cursor: first.next_cursor! }, new AbortController().signal),
  );
  expect(next.items.map((card) => card.id)).toEqual(['my-text-4', 'my-song-5']);
  expect(next.next_cursor).toBeNull();
  const rejected = await wait(
    actions.load({ status: 'rejected' }, new AbortController().signal),
  );
  expect(rejected.items.map((card) => card.id)).toEqual(['my-text-3']);
  expect(rejected.items[0].rejection_reason).toBeTruthy();
  expect(rejected.next_cursor).toBeNull();
});
it('returns an empty page without inventing pending records', async () => {
  jest.useFakeTimers();
  const actions = createMockMyCards('empty');
  expect(await wait(actions.load({}, new AbortController().signal))).toEqual({
    items: [],
    next_cursor: null,
  });
});
it('cleans its timer and abort listener on cancellation and successful completion', async () => {
  jest.useFakeTimers();
  const actions = createMockMyCards(),
    controller = new AbortController();
  const remove = jest.spyOn(controller.signal, 'removeEventListener');
  const pending = actions.load({}, controller.signal);
  const rejection = expect(pending).rejects.toMatchObject({ kind: 'aborted' });
  controller.abort();
  await rejection;
  expect(jest.getTimerCount()).toBe(0);
  expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  await expect(actions.load({}, controller.signal)).rejects.toMatchObject({
    kind: 'aborted',
  });
  const success = new AbortController(),
    cleaned = jest.spyOn(success.signal, 'removeEventListener');
  await wait(actions.load({}, success.signal));
  expect(cleaned).toHaveBeenCalledWith('abort', expect.any(Function));
  expect(jest.getTimerCount()).toBe(0);
});
it('removes all authored kinds/statuses, supports repeat delete and refills page one without omissions', async () => {
  jest.useFakeTimers();
  const actions = createMockMyCards();
  await wait(actions.remove('my-text-1', new AbortController().signal));
  await wait(actions.remove('my-text-1', new AbortController().signal));
  const first = await wait(actions.load({}, new AbortController().signal));
  expect(first.items.map((card) => card.id)).toEqual([
    'my-song-2',
    'my-text-3',
    'my-text-4',
  ]);
  const next = await wait(
    actions.load({ cursor: first.next_cursor! }, new AbortController().signal),
  );
  expect(next.items.map((card) => card.id)).toEqual(['my-song-5']);
  await wait(actions.remove('my-song-2', new AbortController().signal));
  await wait(actions.remove('my-text-3', new AbortController().signal));
  const rest = await wait(actions.load({}, new AbortController().signal));
  expect(rest.items.map((card) => card.id)).toEqual(['my-text-4', 'my-song-5']);
});
it('aborts a pending delete before applying it and removes its listener/timer', async () => {
  jest.useFakeTimers();
  const actions = createMockMyCards('slow-delete'),
    controller = new AbortController();
  const cleaned = jest.spyOn(controller.signal, 'removeEventListener');
  const result = actions.remove('my-text-1', controller.signal);
  const rejection = expect(result).rejects.toMatchObject({ kind: 'aborted' });
  controller.abort();
  await rejection;
  expect(jest.getTimerCount()).toBe(0);
  expect(cleaned).toHaveBeenCalledWith('abort', expect.any(Function));
  const page = await wait(actions.load({}, new AbortController().signal));
  expect(page.items[0].id).toBe('my-text-1');
});
it('accepts the same delete after a committed but lost response', async () => {
  jest.useFakeTimers();
  const actions = createMockMyCards('lost-delete');
  const first = actions.remove('my-text-1', new AbortController().signal);
  const rejection = expect(first).rejects.toMatchObject({ kind: 'network' });
  await jest.runAllTimersAsync();
  await rejection;
  await wait(actions.remove('my-text-1', new AbortController().signal));
  const page = await wait(actions.load({}, new AbortController().signal));
  expect(page.items.map((card) => card.id)).toEqual([
    'my-song-2',
    'my-text-3',
    'my-text-4',
  ]);
});

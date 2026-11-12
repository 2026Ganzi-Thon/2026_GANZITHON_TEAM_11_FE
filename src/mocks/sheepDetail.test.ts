import { afterEach, expect, it, jest } from '@jest/globals';
import { createMockSheepDetail } from './sheepDetail';
import { createMockMorning } from './morning';
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
it('returns 404 for unknown sheep IDs instead of inventing a record', async () => {
  jest.useFakeTimers();
  const load = createMockSheepDetail(() => null);
  expect(
    await settle(load('missing', new AbortController().signal)),
  ).toHaveProperty('error.status', 404);
});
it('cancels lookup work and removes the timer and abort listener', async () => {
  jest.useFakeTimers();
  const find = jest.fn(() => null);
  const controller = new AbortController();
  const remove = jest.spyOn(controller.signal, 'removeEventListener');
  const load = createMockSheepDetail(find);
  const outcome = load('s', controller.signal).catch((error) => error);
  controller.abort();
  expect(await outcome).toMatchObject({ kind: 'aborted' });
  expect(find).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
  expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  expect(
    await load('s', controller.signal).catch((error) => error),
  ).toMatchObject({ kind: 'aborted' });
});
it('looks up the adopted card and closing position from the same morning memory', async () => {
  jest.useFakeTimers();
  const api = createMockMorning();
  const signal = new AbortController().signal;
  expect(await settle(api.loadSheep('preview-adopted', signal))).toHaveProperty(
    'error.status',
    404,
  );
  const result = await settle(
    api.adopt('preview-night', 'preview-text-10', signal),
  );
  expect(result).toHaveProperty('value.card_id', 'preview-text-10');
  const saved = await settle(api.loadSheep('preview-adopted', signal));
  expect(saved).toHaveProperty('value.card.id', 'preview-text-10');
  expect(saved).toHaveProperty('value.position', null);
  expect(saved).toHaveProperty('value.sheep.id', 'preview-adopted');
});

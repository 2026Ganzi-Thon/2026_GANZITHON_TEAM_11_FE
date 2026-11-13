import { afterEach, expect, it, jest } from '@jest/globals';
import type { Card } from '../api/contracts';
import { createMockFluff } from './fluff';
const first: () => Card = () => ({
  id: 'a',
  kind: 'text',
  tone: 'empathy',
  category_id: null,
  author_type: 'seed',
  author_label: '양',
  available: true,
  content: { text: '쉬어 가요.' },
  viewer: { yarn_sent: false, fluff_saved: false, song_saved: false },
});
const signal = () => new AbortController().signal;
async function done<T>(promise: Promise<T>) {
  await jest.runAllTimersAsync();
  return promise;
}
afterEach(() => {
  jest.useRealTimers();
});
it('enforces viewed, available, open-night and boolean targets', async () => {
  jest.useFakeTimers();
  const card = first();
  let viewed = false,
    open = true;
  const api = createMockFluff({
    cards: () => [card],
    viewed: () => viewed,
    isOpen: () => open,
  });
  for (const [id, value, code] of [
    ['a', true, 'CARD_NOT_VIEWED'],
    ['other', true, 'NOT_FOUND'],
  ] as const) {
    const failure = expect(api.set(id, value, signal())).rejects.toMatchObject({
      code,
    });
    await jest.runAllTimersAsync();
    await failure;
  }
  viewed = true;
  const invalid = expect(
    api.set('a', 'true' as never, signal()),
  ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  await jest.runAllTimersAsync();
  await invalid;
  await done(api.set('a', true, signal()));
  await done(api.set('a', true, signal()));
  expect(card.viewer.fluff_saved).toBe(true);
  await done(api.set('a', false, signal()));
  expect(card.viewer.fluff_saved).toBe(false);
  card.available = false;
  const deleted = expect(api.set('a', true, signal())).rejects.toMatchObject({
    code: 'CARD_UNAVAILABLE',
  });
  await jest.runAllTimersAsync();
  await deleted;
  card.available = true;
  open = false;
  const closed = expect(api.set('a', true, signal())).rejects.toMatchObject({
    code: 'NIGHT_CLOSED',
  });
  await jest.runAllTimersAsync();
  await closed;
});
it('checks the night boundary at commit time and cleans aborted timers/listeners', async () => {
  jest.useFakeTimers();
  const card = first();
  let open = true;
  const api = createMockFluff(
    { cards: () => [card], viewed: () => true, isOpen: () => open },
    'slow',
  );
  const controller = new AbortController(),
    remove = jest.spyOn(controller.signal, 'removeEventListener');
  const aborted = expect(
    api.set('a', true, controller.signal),
  ).rejects.toMatchObject({ kind: 'aborted' });
  controller.abort();
  await aborted;
  expect(jest.getTimerCount()).toBe(0);
  expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  const closed = expect(api.set('a', true, signal())).rejects.toMatchObject({
    code: 'NIGHT_CLOSED',
  });
  open = false;
  await jest.runAllTimersAsync();
  await closed;
  expect(card.viewer.fluff_saved).toBe(false);
});
it('reconciles an accepted but lost response using a final false target', async () => {
  jest.useFakeTimers();
  const card = first();
  const api = createMockFluff(
    { cards: () => [card], viewed: () => true, isOpen: () => true },
    'lost-response',
  );
  const lost = expect(api.set('a', true, signal())).rejects.toMatchObject({
    kind: 'network',
  });
  await jest.runAllTimersAsync();
  await lost;
  expect(card.viewer.fluff_saved).toBe(true);
  expect(await done(api.set('a', false, signal()))).toEqual({
    card_id: 'a',
    saved: false,
  });
  expect(card.viewer.fluff_saved).toBe(false);
});

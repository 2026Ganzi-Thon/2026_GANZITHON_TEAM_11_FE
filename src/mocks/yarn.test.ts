import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { Card } from '../api/contracts';
import { createMockYarn } from './yarn';
const card = (): Card => ({
  id: 'c1',
  kind: 'text',
  tone: 'empathy',
  category_id: null,
  author_type: 'seed',
  author_label: '먼저 지나간 양',
  available: true,
  content: { text: '잠깐 쉬어 가요.' },
  viewer: { yarn_sent: false, fluff_saved: false, song_saved: false },
});
const signal = () => new AbortController().signal;
afterEach(() => {
  jest.useRealTimers();
});
async function done<T>(p: Promise<T>) {
  await jest.runAllTimersAsync();
  return p;
}
describe('memory yarn adapter', () => {
  it('stores a bool target without duplicating a repeated send, then cancels it', async () => {
    jest.useFakeTimers();
    const first = card();
    const api = createMockYarn(() => [first]);
    expect(await done(api.set('c1', true, signal()))).toEqual({
      card_id: 'c1',
      sent: true,
    });
    await done(api.set('c1', true, signal()));
    expect(first.viewer.yarn_sent).toBe(true);
    await done(api.set('c1', false, signal()));
    expect(first.viewer.yarn_sent).toBe(false);
  });
  it('does not mutate after abort and removes timers/listeners', async () => {
    jest.useFakeTimers();
    const first = card(),
      controller = new AbortController();
    const remove = jest.spyOn(controller.signal, 'removeEventListener');
    const api = createMockYarn(() => [first], 'slow');
    const fail = expect(
      api.set('c1', true, controller.signal),
    ).rejects.toMatchObject({ kind: 'aborted' });
    controller.abort();
    await fail;
    expect(first.viewer.yarn_sent).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    await expect(api.set('c1', true, controller.signal)).rejects.toMatchObject({
      kind: 'aborted',
    });
  });
  it('requires assigned available content and a boolean', async () => {
    jest.useFakeTimers();
    const first = card();
    const api = createMockYarn(() => [first]);
    for (const [id, target, code] of [
      ['unknown', true, 'NOT_FOUND'],
      ['c1', 'true', 'VALIDATION_ERROR'],
    ] as const) {
      const fail = expect(
        api.set(id, target as never, signal()),
      ).rejects.toMatchObject({ code });
      await jest.runAllTimersAsync();
      await fail;
    }
    first.available = false;
    const fail = expect(api.set('c1', true, signal())).rejects.toMatchObject({
      code: 'CARD_UNAVAILABLE',
    });
    await jest.runAllTimersAsync();
    await fail;
  });
  it('reconciles a lost send response with the final false target', async () => {
    jest.useFakeTimers();
    const first = card();
    const api = createMockYarn(() => [first], 'lost-response');
    const fail = expect(api.set('c1', true, signal())).rejects.toMatchObject({
      kind: 'network',
    });
    await jest.runAllTimersAsync();
    await fail;
    expect(first.viewer.yarn_sent).toBe(true);
    expect(await done(api.set('c1', false, signal()))).toEqual({
      card_id: 'c1',
      sent: false,
    });
    expect(first.viewer.yarn_sent).toBe(false);
  });
  it('keeps offline changes unconfirmed and never claims delivery', async () => {
    jest.useFakeTimers();
    const first = card();
    const api = createMockYarn(() => [first], 'offline');
    for (let i = 0; i < 2; i++) {
      const fail = expect(api.set('c1', true, signal())).rejects.toMatchObject({
        kind: 'network',
      });
      await jest.runAllTimersAsync();
      await fail;
    }
    expect(first.viewer.yarn_sent).toBe(false);
  });
});

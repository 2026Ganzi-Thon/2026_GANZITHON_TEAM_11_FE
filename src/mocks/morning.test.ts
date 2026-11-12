import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { createMockMorning } from './morning';

afterEach(() => {
  jest.useRealTimers();
});
async function settle<T>(promise: Promise<T>) {
  const result = promise.then(
    (value) => ({ value }),
    (error) => ({ error }),
  );
  await jest.runAllTimersAsync();
  return result;
}
describe('morning preview adapter', () => {
  it('returns an existing adoption for the same card after a lost response, with one sheep per night', async () => {
    jest.useFakeTimers();
    const api = createMockMorning('save-lost');
    const signal = new AbortController().signal;
    expect(
      await settle(api.adopt('preview-night', 'preview-song', signal)),
    ).toHaveProperty('error');
    const replay = await settle(
      api.adopt('preview-night', 'preview-song', signal),
    );
    expect(replay).toHaveProperty('value.card_id', 'preview-song');
    expect(
      await settle(api.adopt('preview-night', 'preview-song', signal)),
    ).toEqual(replay);
    expect(
      await settle(api.adopt('preview-night', 'preview-text-1', signal)),
    ).toHaveProperty('error.code', 'ADOPTION_ALREADY_FINALIZED');
    const flock = await settle(api.loadFlock(signal));
    if (!('value' in flock)) throw new Error('Expected flock');
    expect(
      flock.value.filter((s) => s.night_id === 'preview-night'),
    ).toHaveLength(1);
  });
  it('rejects cards outside the candidates and unavailable cards without adding sheep', async () => {
    jest.useFakeTimers();
    const api = createMockMorning('unavailable');
    const signal = new AbortController().signal;
    const before = await settle(api.loadFlock(signal));
    expect(
      await settle(api.adopt('preview-night', 'unknown', signal)),
    ).toHaveProperty('error.code', 'INVALID_ADOPTION_CARD');
    expect(
      await settle(api.adopt('preview-night', 'preview-text-1', signal)),
    ).toHaveProperty('error.code', 'CARD_UNAVAILABLE');
    expect(await settle(api.loadFlock(signal))).toEqual(before);
  });
  it('cleans timers and listeners on completion and cancellation and rejects already aborted calls', async () => {
    jest.useFakeTimers();
    const api = createMockMorning();
    const controller = new AbortController();
    const remove = jest.spyOn(controller.signal, 'removeEventListener');
    const result = api.loadMorning(controller.signal).catch((error) => error);
    controller.abort();
    expect(await result).toMatchObject({ kind: 'aborted' });
    expect(jest.getTimerCount()).toBe(0);
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(
      await api.loadMorning(controller.signal).catch((error) => error),
    ).toMatchObject({ kind: 'aborted' });
    const next = new AbortController();
    const removeNext = jest.spyOn(next.signal, 'removeEventListener');
    expect(await settle(api.loadMorning(next.signal))).toHaveProperty(
      'value.counted_sheep',
      14,
    );
    expect(removeNext).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(jest.getTimerCount()).toBe(0);
  });
});

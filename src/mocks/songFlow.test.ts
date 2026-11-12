import { it, expect, jest, afterEach } from '@jest/globals';
import { createNightMorningDemo } from './nightMorningDemo';
const signal = () => new AbortController().signal;
async function done<T>(p: Promise<T>) {
  await jest.runAllTimersAsync();
  return p;
}
afterEach(() => {
  jest.useRealTimers();
});
it('keeps song state across feed reload, morning list and removal without duplicates', async () => {
  jest.useFakeTimers();
  const d = createNightMorningDemo();
  await done(
    d.entry.checkWorry({ category_id: 'none', worry_text: null }, signal()),
  );
  await done(d.entry.startCounting(6, signal()));
  let cards = await done(d.loadFeed(signal()));
  const failure = expect(
    d.songs.set(cards[2].id, true, signal()),
  ).rejects.toMatchObject({ code: 'CARD_NOT_VIEWED' });
  await jest.runAllTimersAsync();
  await failure;
  d.progress({ position: 3, furthestPosition: 3 });
  await done(d.songs.set(cards[2].id, true, signal()));
  await done(d.songs.set(cards[2].id, true, signal()));
  cards = await done(d.loadFeed(signal()));
  expect(cards[2].viewer.song_saved).toBe(true);
  await done(
    d.closing.finish(
      { reason: 'leave', position: 3, furthestPosition: 3, sheepCount: 6 },
      'finish',
      signal(),
    ),
  );
  d.advanceMorning();
  expect(await done(d.songs.load(signal()))).toHaveLength(1);
  const closed = expect(
    d.songs.set(cards[2].id, true, signal()),
  ).rejects.toMatchObject({ code: 'NIGHT_CLOSED' });
  await jest.runAllTimersAsync();
  await closed;
  await done(d.songs.set(cards[2].id, false, signal()));
  expect(await done(d.songs.load(signal()))).toEqual([]);
  expect((await done(d.loadFeed(signal())))[2].viewer.song_saved).toBe(false);
});

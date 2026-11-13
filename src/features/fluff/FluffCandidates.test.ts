import { afterEach, expect, it, jest } from '@jest/globals';
import { createNightMorningDemo } from '../../mocks/nightMorningDemo';
const signal = () => new AbortController().signal;
async function done<T>(promise: Promise<T>) {
  await jest.runAllTimersAsync();
  return promise;
}
async function night(count = 6) {
  jest.useFakeTimers();
  const demo = createNightMorningDemo();
  await done(
    demo.entry.checkWorry({ category_id: 'none', worry_text: null }, signal()),
  );
  await done(demo.entry.startCounting(count, signal()));
  return { demo, cards: await done(demo.loadFeed(signal())) };
}
afterEach(() => {
  jest.useRealTimers();
});
it('counts and presents a repeated card only once with its shared bookmark state', async () => {
  const { demo: d, cards } = await night(3);
  cards[1].id = cards[0].id;
  d.progress({ position: 3, furthestPosition: 3 });
  await done(d.fluff.set(cards[0].id, true, signal()));
  const f = await done(
    d.closing.finish(
      { reason: 'completed', position: 3, furthestPosition: 3, sheepCount: 3 },
      'finish',
      signal(),
    ),
  );
  expect(f.summary.fluff_count).toBe(1);
  d.advanceMorning();
  const m = await done(d.morning.loadMorning(signal()));
  expect(m.candidate_cards.map((c) => c.card.id)).toEqual([
    'preview-card-1',
    'preview-card-3',
  ]);
  expect(m.candidate_cards[0].fluff_saved).toBe(true);
});
it('counts unique confirmed marks and sorts marked candidates first without changing the warm default', async () => {
  const { demo: d, cards } = await night();
  d.progress({ position: 6, furthestPosition: 6 });
  await done(d.fluff.set(cards[0].id, true, signal()));
  await done(d.fluff.set(cards[0].id, true, signal()));
  await done(d.fluff.set(cards[2].id, true, signal()));
  await done(d.fluff.set(cards[2].id, false, signal()));
  const finish = await done(
    d.closing.finish(
      { reason: 'completed', position: 6, furthestPosition: 6, sheepCount: 6 },
      'finish',
      signal(),
    ),
  );
  expect(finish.summary.fluff_count).toBe(1);
  d.advanceMorning();
  const m = await done(d.morning.loadMorning(signal()));
  expect(m.candidate_cards.map((c) => c.card.id)).toEqual([
    'preview-card-1',
    'preview-card-6',
    'preview-card-5',
    'preview-card-4',
    'preview-card-3',
    'preview-card-2',
  ]);
  expect(m.candidate_cards[0].fluff_saved).toBe(true);
  expect(m.candidate_cards[0].card.viewer.fluff_saved).toBe(true);
  expect(m.default_card_id).toBe('preview-card-6');
});
it('uses revisit recency within marked cards and keeps unseen cards out of an early morning', async () => {
  const { demo: d, cards } = await night();
  d.progress({ position: 3, furthestPosition: 3 });
  await done(d.fluff.set(cards[0].id, true, signal()));
  await done(d.fluff.set(cards[1].id, true, signal()));
  d.progress({ position: 1, furthestPosition: 3 });
  await done(
    d.closing.finish(
      { reason: 'leave', position: 1, furthestPosition: 3, sheepCount: 6 },
      'finish',
      signal(),
    ),
  );
  d.advanceMorning();
  const m = await done(d.morning.loadMorning(signal()));
  expect(m.candidate_cards.map((c) => c.card.id)).toEqual([
    'preview-card-1',
    'preview-card-2',
    'preview-card-3',
  ]);
  expect(m.default_card_id).toBe('preview-card-1');
});
it('does not include a deleted marked card in the count and retains its unselectable placeholder', async () => {
  const { demo: d, cards } = await night(3);
  await done(d.fluff.set(cards[0].id, true, signal()));
  cards[0].available = false;
  cards[0].content = null;
  d.progress({ position: 3, furthestPosition: 3 });
  const f = await done(
    d.closing.finish(
      { reason: 'completed', position: 3, furthestPosition: 3, sheepCount: 3 },
      'finish',
      signal(),
    ),
  );
  expect(f.summary.fluff_count).toBe(0);
  d.advanceMorning();
  const m = await done(d.morning.loadMorning(signal()));
  expect(
    m.candidate_cards.find((c) => c.card.id === 'preview-card-1'),
  ).toMatchObject({ can_adopt: false, fluff_saved: false });
});

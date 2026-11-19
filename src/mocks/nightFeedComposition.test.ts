import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import type { Card } from '../api/contracts';
import { createMockNightFeed } from './nightFeed';
import { createNightMorningDemo } from './nightMorningDemo';
import { settle, signal, start } from './__tests__/nightHistory';

// Literal expectations from API v0.6 §13, separate from the planner under test.
const positions: [number, number[], number[]][] = [
  [3, [], []],
  [4, [], []],
  [5, [], [3]],
  [6, [], [3]],
  [7, [4], [5]],
  [8, [4], [5]],
  [9, [5], [6]],
  [10, [5], [6]],
  [11, [6], [8]],
  [12, [6], [8]],
  [13, [6], [8]],
  [14, [6], [8]],
  [15, [6], [8, 12]],
  [16, [6, 14], [8, 12]],
  [17, [6, 14], [8, 15]],
  [18, [6, 14], [8, 15]],
  [19, [6, 14], [8, 16]],
  [20, [6, 14], [8, 17]],
  [21, [6, 14], [9, 18]],
  [22, [6, 14], [9, 19]],
  [23, [6, 14], [10, 20]],
  [24, [6, 14], [10, 22]],
  [25, [6, 14], [10, 22]],
  [26, [6, 14], [11, 23]],
  [27, [6, 14], [11, 24]],
  [28, [6, 14], [12, 25]],
  [29, [6, 14], [12, 26]],
  [30, [6, 14], [12, 27]],
];
const noWorrySongs: Record<number, number[]> = {
  7: [4],
  8: [4],
  9: [5],
  10: [5],
  11: [6],
  12: [6],
  13: [8],
  14: [8],
  15: [6, 12],
};
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});
const at = (cards: Card[], match: (card: Card) => boolean) =>
  cards.flatMap((card, index) => (match(card) ? [index + 1] : []));

it.each(positions)(
  'composes %i slots with a worry using the specification positions',
  async (count, pauses, songs) => {
    const cards = await settle(
      createMockNightFeed(count, 'success', { hasWorry: true })(signal()),
    );
    expect(cards).toHaveLength(count);
    expect(new Set(cards.map((card) => card.id)).size).toBe(count);
    expect(at(cards, (c) => !c.available)).toEqual(pauses);
    expect(at(cards, (c) => c.kind === 'song')).toEqual(songs);
    const warm = [7, 13, 21, 28].filter((p) => p < count).concat(count);
    expect(at(cards, (c) => c.tone === 'warm')).toEqual(warm);
    expect(cards[0]).toMatchObject({
      kind: 'text',
      tone: 'empathy',
      available: true,
    });
    const tracks = cards.filter(
      (c): c is Extract<Card, { kind: 'song' }> => c.kind === 'song',
    );
    if (tracks.length)
      expect(tracks[0]).toMatchObject({
        author_type: 'ai',
        author_label: null,
        content: { recommendation: null },
      });
    if (tracks.length === 2)
      expect(tracks[1]).toMatchObject({
        author_type: 'user',
        author_label: '먼저 지나간 양',
      });
    for (const index of songs) {
      expect(index).toBeGreaterThan(1);
      expect(index).toBeLessThanOrEqual(count - 2);
    }
  },
);
it.each(positions)(
  'composes %i slots without a worry and without AI or entrust cards',
  async (count, _pauses, songs) => {
    const cards = await settle(
      createMockNightFeed(count, 'success', { hasWorry: false })(signal()),
    );
    expect(cards).toHaveLength(count);
    expect(at(cards, (c) => !c.available)).toEqual(count >= 16 ? [14] : []);
    expect(at(cards, (c) => c.kind === 'song')).toEqual(
      noWorrySongs[count] ?? songs,
    );
    expect(cards.some((c) => c.author_type === 'ai')).toBe(false);
    expect(cards[0]).toMatchObject({ tone: 'light', category_id: null });
    expect(cards.at(-1)).toMatchObject({
      kind: 'text',
      tone: 'warm',
      available: true,
    });
    for (const c of cards) {
      if (c.kind === 'song')
        expect(c).toMatchObject({
          author_type: 'user',
          author_label: '먼저 지나간 양',
          category_id: null,
        });
    }
    const trackIds = cards.flatMap((c) =>
      c.kind === 'song' && c.content ? [c.content.track.id] : [],
    );
    expect(new Set(trackIds).size).toBe(trackIds.length);
  },
);
it('captures the night context before loading and returns independent card data on retry', async () => {
  const context = { hasWorry: true };
  const load = createMockNightFeed(5, 'success', context);
  context.hasWorry = false;
  const cards = await settle(load(signal()));
  expect(cards[0].category_id).toBe('career');
  if (cards[0].kind !== 'text' || !cards[0].content)
    throw new Error('Missing text fixture');
  cards[0].content.text = 'changed by a consumer';
  const again = await settle(load(signal()));
  expect(again[0]).toMatchObject({
    category_id: 'career',
    content: {
      text: '나도 결과 기다리는 밤이 제일 길었어. 기다리는 동안 너는 이미 할 만큼 한 거야.',
    },
  });
});
it('repeats empathy, empathy, light only in ordinary slots after reserving songs and pauses', async () => {
  const cards = await settle(
    createMockNightFeed(10, 'success', { hasWorry: true })(signal()),
  );
  expect(cards.map((c) => c.tone)).toEqual([
    'empathy',
    'empathy',
    'light',
    'empathy',
    null,
    null,
    'warm',
    'empathy',
    'light',
    'warm',
  ]);
});
it('integrates a 16-slot night with paused positions excluded from morning candidates and reactions bound to the displayed song', async () => {
  const demo = createNightMorningDemo();
  const cards = await start(demo, 16);
  expect(at(cards, (c) => c.kind === 'song')).toEqual([8, 12]);
  expect(demo.entrust?.item.position).toBe(6);
  expect(demo.stopOffer?.position).toBe(14);
  demo.progress({ position: 12, furthestPosition: 12 });
  await settle(demo.songs.set(cards[11].id, true, signal()));
  demo.progress({ position: 16, furthestPosition: 16 });
  await settle(
    demo.closing.finish(
      {
        reason: 'completed',
        position: 16,
        furthestPosition: 16,
        sheepCount: 16,
      },
      'finish-composition',
      signal(),
    ),
  );
  demo.advanceMorning();
  const morning = await settle(demo.morning.loadMorning(signal()));
  expect(morning.candidate_cards.map((c) => c.position)).not.toContain(6);
  expect(morning.candidate_cards.map((c) => c.position)).not.toContain(14);
  expect(morning.candidate_cards).toHaveLength(14);
  const saved = await settle(demo.morning.songs!.load(signal()));
  expect(saved.map((s) => s.card_id)).toEqual([cards[11].id]);
});

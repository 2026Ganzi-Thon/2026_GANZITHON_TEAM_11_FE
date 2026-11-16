import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { ApiError } from '../api/errors';
import { readNightReturnRoute } from '../features/night/nightReturn/model';
import { createNightMorningDemo } from './nightMorningDemo';
import { start, finish, signal, settle } from './__tests__/nightHistory';
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});
const make = (
  scenario: Parameters<typeof createNightMorningDemo>[0] = 'success',
) =>
  createNightMorningDemo(scenario, {
    nightId: 'same-night',
    nightDate: '2026-11-16',
    expiry: {
      now: () => Date.parse('2026-11-16T22:00:00+09:00'),
      closesAt: '2026-11-17T04:00:00+09:00',
    },
    manageWorries: true,
  });
async function end(demo: ReturnType<typeof make>) {
  demo.progress({ position: 3, furthestPosition: 3 });
  await finish(demo);
  await settle(demo.closing.chooseWriting('morning', 'offer', signal()));
  demo.confirmClosing();
}
it('allows a new session only after closing confirmation and keeps the same worry and all candidates', async () => {
  const d = make();
  const first = await start(d);
  d.progress({ position: 3, furthestPosition: 3 });
  await finish(d);
  expect(
    readNightReturnRoute(await settle(d.returning.load(signal()))).kind,
  ).toBe('closing');
  await expect(settle(d.returning.create(5, signal()))).rejects.toMatchObject({
    code: 'CLOSING_NOT_CONFIRMED',
  });
  await settle(d.closing.chooseWriting('morning', 'offer', signal()));
  d.confirmClosing();
  expect(
    readNightReturnRoute(await settle(d.returning.load(signal()))),
  ).toMatchObject({ kind: 'return', record: { summary: { counted: 3 } } });
  await settle(d.returning.create(5, signal()));
  const next = await settle(d.loadFeed(signal()));
  expect(next[0].id).not.toBe(first[0].id);
  expect(d.getRecord().night?.worry_text).toBe('첫째 밤의 고민');
  d.progress({ position: 2, furthestPosition: 2 });
  await settle(
    d.closing.finish(
      { reason: 'leave', position: 2, furthestPosition: 2, sheepCount: 5 },
      'second',
      signal(),
    ),
  );
  d.advanceMorning();
  const m = await settle(d.morning.loadMorning(signal()));
  expect(m.counted_sheep).toBe(5);
  expect(m.candidate_cards).toHaveLength(5);
  expect(m.writing_offer?.state).toBe('deferred');
  const sheep = await settle(d.morning.adopt(d.nightId, first[0].id, signal()));
  await expect(
    settle(d.morning.adopt(d.nightId, next[0].id, signal())),
  ).rejects.toMatchObject({ code: 'ADOPTION_ALREADY_FINALIZED' });
  expect(await settle(d.morning.loadFlock(signal()))).toEqual([sheep]);
});
it('recovery reads an existing created session after a lost receipt without creating another', async () => {
  const d = make('return-create-lost');
  await start(d);
  await end(d);
  await expect(settle(d.returning.create(5, signal()))).rejects.toMatchObject({
    kind: 'network',
  });
  expect(
    readNightReturnRoute(await settle(d.returning.load(signal()))).kind,
  ).toBe('feed');
  await expect(settle(d.returning.create(5, signal()))).rejects.toMatchObject({
    code: 'ACTIVE_SESSION_EXISTS',
  });
  expect(d.getSession()?.sheepCount).toBe(5);
});
it('does not revive deleted worry, lose first-session reactions, or offer writing twice', async () => {
  const d = make();
  const cards = await start(d);
  await settle(d.yarn.set(cards[0].id, true, signal()));
  await settle(d.fluff.set(cards[0].id, true, signal()));
  await end(d);
  d.worryRecords.eraseRecord(d.nightId);
  await settle(d.returning.create(3, signal()));
  await settle(d.loadFeed(signal()));
  d.progress({ position: 3, furthestPosition: 3 });
  const result = await finish(d);
  expect(result.writing_offer.state).toBe('deferred');
  expect(d.getRecord().night?.worry_text).toBeNull();
  d.advanceMorning();
  const m = await settle(d.morning.loadMorning(signal()));
  const previous = m.candidate_cards.find((x) => x.card.id === cards[0].id)!;
  expect(previous.card.viewer).toMatchObject({
    yarn_sent: true,
    fluff_saved: true,
  });
  expect(m.counted_sheep).toBe(6);
});
it('blocks a delayed restart at 04:00 and preserves the prior night total', async () => {
  let now = Date.parse('2026-11-17T03:59:59+09:00');
  const d = createNightMorningDemo('success', {
    nightDate: '2026-11-16',
    expiry: { now: () => now, closesAt: '2026-11-17T04:00:00+09:00' },
  });
  await start(d);
  await end(d);
  const p = d.returning.create(5, signal());
  const failed = expect(p).rejects.toBeInstanceOf(ApiError);
  now += 1000;
  await jest.runAllTimersAsync();
  await failed;
  expect(
    readNightReturnRoute(await settle(d.returning.load(signal()))).kind,
  ).toBe('morning');
  expect((await settle(d.morning.loadMorning(signal()))).counted_sheep).toBe(3);
});
it('cancels a pending create without archiving or duplicating a session', async () => {
  const d = make();
  await start(d);
  await end(d);
  const controller = new AbortController();
  const p = d.returning.create(5, controller.signal);
  const rejected = expect(p).rejects.toMatchObject({ kind: 'aborted' });
  controller.abort();
  await rejected;
  expect(
    readNightReturnRoute(await settle(d.returning.load(signal()))),
  ).toMatchObject({ kind: 'return', record: { summary: { counted: 3 } } });
  await settle(d.returning.create(3, signal()));
  await settle(d.loadFeed(signal()));
  d.progress({ position: 3, furthestPosition: 3 });
  await finish(d);
  d.advanceMorning();
  expect((await settle(d.morning.loadMorning(signal()))).counted_sheep).toBe(6);
});
it('retains saved music across sessions and uses a different warm closing card after a second early finish', async () => {
  const d = make();
  const first = await start(d, 9);
  const song = first.find((c) => c.kind === 'song')!;
  const n = first.findIndex((c) => c.id === song.id) + 1;
  d.progress({ position: n, furthestPosition: n });
  await settle(d.songs.set(song.id, true, signal()));
  const input = {
    reason: 'leave' as const,
    position: n,
    furthestPosition: n,
    sheepCount: 9,
  };
  const a = await settle(d.closing.finish(input, 'first', signal()));
  await settle(d.closing.markViewed(a.closing_card!.id, 'view1', signal()));
  await settle(d.closing.chooseWriting('morning', 'offer', signal()));
  d.confirmClosing();
  await settle(d.returning.create(3, signal()));
  await settle(d.loadFeed(signal()));
  d.progress({ position: 1, furthestPosition: 1 });
  const b = await settle(
    d.closing.finish(
      { reason: 'leave', position: 1, furthestPosition: 1, sheepCount: 3 },
      'second',
      signal(),
    ),
  );
  expect(b.closing_card!.id).not.toBe(a.closing_card!.id);
  expect(b.closing_card!.content).not.toEqual(a.closing_card!.content);
  await settle(d.closing.markViewed(b.closing_card!.id, 'view2', signal()));
  d.advanceMorning();
  const songs = await settle(d.songs.load(signal()));
  expect(songs.map((x) => x.card_id)).toContain(song.id);
  const m = await settle(d.morning.loadMorning(signal()));
  expect(m.counted_sheep).toBe(n + 1);
  expect(m.candidate_cards.map((x) => x.card.id)).toEqual(
    expect.arrayContaining([a.closing_card!.id, b.closing_card!.id]),
  );
  await settle(d.songs.set(song.id, false, signal()));
  expect(await settle(d.songs.load(signal()))).toEqual([]);
});
it('ignores a closing confirmation that reaches the 04:00 boundary before the UI timer', async () => {
  let now = Date.parse('2026-11-16T23:00:00+09:00');
  const d = createNightMorningDemo('success', {
    nightDate: '2026-11-16',
    expiry: { now: () => now, closesAt: '2026-11-17T04:00:00+09:00' },
  });
  await start(d);
  d.progress({ position: 3, furthestPosition: 3 });
  await finish(d);
  await settle(d.closing.chooseWriting('morning', 'offer', signal()));
  now = Date.parse('2026-11-17T04:00:00+09:00');
  expect(d.confirmClosing()).toBe(false);
  expect((await settle(d.morning.loadMorning(signal()))).counted_sheep).toBe(3);
});

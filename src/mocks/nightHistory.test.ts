import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { createMockNightHistory } from './nightHistory';
import {
  complete,
  finish,
  signal,
  start,
  settle,
} from './__tests__/nightHistory';
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});
it('counts started nights and actual furthest progress, retaining a stable session and navigation on the same date', async () => {
  const h = createMockNightHistory(),
    a = h.openNight('2026-11-16');
  expect(h.getNight('2026-11-17')).toBeNull();
  expect(h.getStats()).toEqual({
    night_count: 0,
    counted_sheep_total: 0,
    worry_record_count: 0,
  });
  await settle(
    a.demo.entry.checkWorry(
      { category_id: 'career', worry_text: '고민만 적은 밤' },
      signal(),
    ),
  );
  expect(h.getStats()).toEqual({
    night_count: 0,
    counted_sheep_total: 0,
    worry_record_count: 1,
  });
  await settle(a.demo.entry.startCounting(10, signal()));
  expect(h.getStats()).toEqual({
    night_count: 1,
    counted_sheep_total: 0,
    worry_record_count: 1,
  });
  await settle(a.demo.loadFeed(signal()));
  expect(h.getStats().counted_sheep_total).toBe(0);
  a.demo.progress({ position: 2, furthestPosition: 2 });
  a.demo.progress({ position: 1, furthestPosition: 2 });
  a.navigation.pause('feed');
  const again = h.openNight('2026-11-16');
  expect(again).toBe(a);
  expect(again.navigation.getSnapshot()).toMatchObject({
    page: 'paused',
    resume: 'feed',
  });
  expect(again.demo.getProgress()).toEqual({
    position: 1,
    furthestPosition: 2,
  });
  expect(h.getStats()).toEqual({
    night_count: 1,
    counted_sheep_total: 2,
    worry_record_count: 1,
  });
  const b = h.openNight('2026-11-17');
  expect(b.navigation.getSnapshot().page).toBe('entry');
  expect(h.getStats().night_count).toBe(1);
});
it('accumulates two nights without replacing the first sheep, reflection or detail and lists the most recent first', async () => {
  const h = createMockNightHistory(),
    a = h.openNight('2026-11-16'),
    b = h.openNight('2026-11-17');
  const first = await complete(a.demo, 3, '첫째 고민'),
    second = await complete(b.demo, 5, '둘째 고민');
  await settle(a.morning.reflection!.save(a.demo.nightId, 'smaller', signal()));
  await settle(b.morning.reflection!.save(b.demo.nightId, 'bigger', signal()));
  expect(first.id).not.toBe(second.id);
  expect(h.getStats()).toEqual({
    night_count: 2,
    counted_sheep_total: 8,
    worry_record_count: 2,
  });
  expect(await h.loadFlock(signal())).toEqual([second, first]);
  expect(await b.morning.loadFlock(signal())).toEqual([second, first]);
  expect(
    (await settle(a.morning.loadMorning(signal()))).night?.night_date,
  ).toBe('2026-11-16');
  expect((await settle(h.loadSheep(first.id, signal()))).night).toMatchObject({
    night_date: '2026-11-16',
    worry_text: '첫째 고민',
    reflection: { answer: 'smaller' },
  });
  expect((await settle(h.loadSheep(second.id, signal()))).night).toMatchObject({
    night_date: '2026-11-17',
    worry_text: '둘째 고민',
    reflection: { answer: 'bigger' },
  });
  expect(
    (await h.worries.load({}, signal())).items.map((item) => [
      item.night_date,
      item.worry_text,
      item.reflection?.answer,
    ]),
  ).toEqual([
    ['2026-11-17', '둘째 고민', 'bigger'],
    ['2026-11-16', '첫째 고민', 'smaller'],
  ]);
});
it('isolates late completion of a previous night from the newly opened night', async () => {
  const h = createMockNightHistory(),
    a = h.openNight('2026-11-16');
  await start(a.demo);
  a.demo.progress({ position: 3, furthestPosition: 3 });
  const pending = finish(a.demo);
  const b = h.openNight('2026-11-17');
  await pending;
  expect(a.demo.getRecord().finished).toBe(true);
  expect(b.demo.getRecord().finished).toBe(false);
  expect(b.demo.getRecord().night).toBeNull();
  expect(b.demo.getProgress()).toEqual({ position: 1, furthestPosition: 1 });
  expect(h.getStats()).toEqual({
    night_count: 1,
    counted_sheep_total: 3,
    worry_record_count: 1,
  });
});
it('recovers lost finish and adoption responses in each night without duplicating totals or sheep', async () => {
  const h = createMockNightHistory({ scenario: 'lost-responses' });
  for (const date of ['2026-11-16', '2026-11-17']) {
    const n = h.openNight(date);
    await start(n.demo);
    n.demo.progress({ position: 3, furthestPosition: 3 });
    await expect(finish(n.demo)).rejects.toMatchObject({ kind: 'network' });
    await finish(n.demo);
    n.demo.advanceMorning();
    const m = await settle(n.morning.loadMorning(signal()));
    await expect(
      settle(n.morning.adopt(n.demo.nightId, m.default_card_id!, signal())),
    ).rejects.toMatchObject({ kind: 'network' });
    await settle(
      Promise.all([
        n.morning.adopt(n.demo.nightId, m.default_card_id!, signal()),
        n.morning.adopt(n.demo.nightId, m.default_card_id!, signal()),
      ]),
    );
  }
  expect(h.getStats()).toEqual({
    night_count: 2,
    counted_sheep_total: 6,
    worry_record_count: 2,
  });
  expect(await h.loadFlock(signal())).toHaveLength(2);
});
it.each(['2026-02-30', '2026-13-01', '2026-1-01', 'not-a-date'])(
  'rejects invalid fixture date %s without creating a night',
  (date) => {
    const h = createMockNightHistory();
    expect(() => h.openNight(date)).toThrow();
    expect(h.getStats().night_count).toBe(0);
  },
);
it('returns empty account projections and rejects missing details or canceled reads', async () => {
  const h = createMockNightHistory();
  expect(await h.loadFlock(signal())).toEqual([]);
  expect(await h.worries.load({}, signal())).toEqual({
    items: [],
    next_cursor: null,
  });
  await expect(h.loadSheep('missing', signal())).rejects.toMatchObject({
    status: 404,
  });
  await expect(
    h.worries.load({ cursor: 'missing' }, signal()),
  ).rejects.toMatchObject({ kind: 'configuration' });
  const c = new AbortController();
  const pending = h.worries.load({}, c.signal);
  c.abort();
  await expect(pending).rejects.toMatchObject({ kind: 'aborted' });
  await expect(h.loadFlock(c.signal)).rejects.toMatchObject({
    kind: 'aborted',
  });
});

import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { createMockHomeJourney } from './homeJourney';
const signal = () => new AbortController().signal;
async function settle<T>(p: Promise<T>) {
  await jest.runAllTimersAsync();
  return p;
}
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});
async function finish(source: ReturnType<typeof createMockHomeJourney>) {
  await settle(
    source.night.entry.checkWorry(
      { category_id: 'career', worry_text: '면접이 걱정돼요' },
      signal(),
    ),
  );
  await settle(source.night.entry.startCounting(3, signal()));
  await settle(source.night.loadFeed(signal()));
  source.night.progress({ position: 3, furthestPosition: 3 });
  return settle(
    source.night.closing.finish(
      { reason: 'completed', position: 3, furthestPosition: 3, sheepCount: 3 },
      'finish-once',
      signal(),
    ),
  );
}
it('projects one shared night into profile, morning, detail and settings without duplicated totals', async () => {
  const source = createMockHomeJourney();
  expect(
    (await settle(source.home.clock.load(signal()))).user.stats.night_count,
  ).toBe(0);
  await finish(source);
  expect(
    (await settle(source.home.clock.load(signal()))).user.stats.night_count,
  ).toBe(1);
  expect(
    (await settle(source.home.settings!.loadMe(signal()))).user.stats,
  ).toEqual({ night_count: 1, counted_sheep_total: 3, worry_record_count: 1 });
  expect(
    (await settle(source.home.morning.loadMorning(signal()))).candidate_cards,
  ).toEqual([]);
  source.advanceMorning();
  source.advanceMorning();
  const morning = await settle(source.home.morning.loadMorning(signal()));
  expect(morning.night!.night_date).toBe('2026-11-16');
  expect(morning.counted_sheep).toBe(3);
  const sheep = await settle(
    source.home.morning.adopt(
      morning.night!.id,
      morning.default_card_id!,
      signal(),
    ),
  );
  await settle(
    source.home.morning.adopt(
      morning.night!.id,
      morning.default_card_id!,
      signal(),
    ),
  );
  expect(await settle(source.home.morning.loadFlock(signal()))).toEqual([
    sheep,
  ]);
  const answer = await settle(
    source.home.morning.reflection!.save(
      morning.night!.id,
      'smaller',
      signal(),
    ),
  );
  const records = await settle(
    source.home.settings!.worries.load({}, signal()),
  );
  expect(records.items[0]).toMatchObject({
    night_date: '2026-11-16',
    worry_text: '면접이 걱정돼요',
    reflection: answer,
  });
  expect(
    (await settle(source.home.loadDetail!(sheep.id, signal()))).night,
  ).toMatchObject({
    night_date: '2026-11-16',
    worry_text: '면접이 걱정돼요',
    reflection: answer,
  });
  expect(
    (await settle(source.home.settings!.loadMe(signal()))).user.stats
      .night_count,
  ).toBe(1);
  expect((await settle(source.home.clock.load(signal()))).phase).toBe('day');
});
it('deletes the shared worry and reflection from settings without removing the sheep or changing counted totals', async () => {
  const source = createMockHomeJourney();
  await finish(source);
  source.advanceMorning();
  const morning = await settle(source.home.morning.loadMorning(signal())),
    id = morning.night!.id;
  const sheep = await settle(
    source.home.morning.adopt(id, morning.default_card_id!, signal()),
  );
  await settle(source.home.morning.reflection!.save(id, 'smaller', signal()));
  await settle(source.home.settings!.deletions!.records!.remove(id, signal()));
  expect(
    (await settle(source.home.settings!.worries.load({}, signal()))).items,
  ).toEqual([]);
  expect(
    (await settle(source.home.loadDetail!(sheep.id, signal()))).night,
  ).toMatchObject({ worry_text: null, reflection: null });
  expect(
    (await settle(source.home.morning.reflection!.load(id, signal()))).night
      ?.worry_text,
  ).toBeNull();
  expect(
    (await settle(source.home.settings!.loadMe(signal()))).user.stats,
  ).toEqual({ night_count: 1, counted_sheep_total: 3, worry_record_count: 0 });
  expect(await settle(source.home.morning.loadFlock(signal()))).toEqual([
    sheep,
  ]);
});
it('does not create a counted night for a worry-only record or an empty query failure', async () => {
  const source = createMockHomeJourney('home-retry');
  const failed = expect(
    settle(source.home.clock.load(signal())),
  ).rejects.toMatchObject({ kind: 'network' });
  await failed;
  await settle(
    source.night.entry.checkWorry(
      { category_id: 'none', worry_text: null },
      signal(),
    ),
  );
  expect(
    (await settle(source.home.clock.load(signal()))).user.stats.night_count,
  ).toBe(0);
  expect(
    (await settle(source.home.settings!.worries.load({}, signal()))).items,
  ).toEqual([]);
  expect(() => source.advanceMorning()).toThrow();
});
it('recovers a lost finish and adopt receipt without duplicating account totals or sheep', async () => {
  const source = createMockHomeJourney('lost-responses');
  await expect(finish(source)).rejects.toMatchObject({ kind: 'network' });
  expect(
    (await settle(source.home.settings!.loadMe(signal()))).user.stats
      .night_count,
  ).toBe(1);
  await settle(
    source.night.closing.finish(
      { reason: 'completed', position: 3, furthestPosition: 3, sheepCount: 3 },
      'finish-once',
      signal(),
    ),
  );
  source.advanceMorning();
  const morning = await settle(source.home.morning.loadMorning(signal())),
    id = morning.night!.id;
  await expect(
    settle(source.home.morning.adopt(id, morning.default_card_id!, signal())),
  ).rejects.toMatchObject({ kind: 'network' });
  await settle(
    source.home.morning.adopt(id, morning.default_card_id!, signal()),
  );
  expect((await settle(source.home.morning.loadFlock(signal()))).length).toBe(
    1,
  );
  expect(
    (await settle(source.home.settings!.loadMe(signal()))).user.stats,
  ).toMatchObject({ night_count: 1, counted_sheep_total: 3 });
});
it('does not rewind the account clock when next morning is requested twice', async () => {
  const source = createMockHomeJourney();
  await finish(source);
  source.advanceMorning();
  await jest.advanceTimersByTimeAsync(60000);
  const before = await settle(source.home.clock.load(signal()));
  source.advanceMorning();
  const after = await settle(source.home.clock.load(signal()));
  expect(Date.parse(after.server_time)).toBeGreaterThanOrEqual(
    Date.parse(before.server_time),
  );
});
it('uses the same mock account date for birth validation and the next morning clock', async () => {
  const source = createMockHomeJourney();
  expect(
    (await settle(source.home.settings!.birthDate!.load(signal()))).today,
  ).toBe('2026-11-16');
  await finish(source);
  source.advanceMorning();
  expect(
    (await settle(source.home.settings!.birthDate!.load(signal()))).today,
  ).toBe('2026-11-17');
});
it('keeps an injected signup identity and clock through the next morning', async () => {
  let time = Date.parse('2026-11-16T14:20:00+09:00');
  const options = {
    identity: { id: 'registered-account', email: 'joined@example.com' },
    clock: {
      now: () => time,
      advanceMorning: () => {
        time = Date.parse('2026-11-17T04:00:00+09:00');
      },
    },
  };
  const source = createMockHomeJourney('success', options);
  expect((await settle(source.home.clock.load(signal()))).phase).toBe('day');
  expect(
    (await settle(source.home.settings!.loadMe(signal()))).user,
  ).toMatchObject({
    id: 'registered-account',
    email: 'joined@example.com',
  });
  time = Date.parse('2026-11-16T21:00:00+09:00');
  await finish(source);
  source.advanceMorning();
  expect(time).toBe(Date.parse('2026-11-17T04:00:00+09:00'));
  expect(
    (await settle(source.home.settings!.birthDate!.load(signal()))).today,
  ).toBe('2026-11-17');
});

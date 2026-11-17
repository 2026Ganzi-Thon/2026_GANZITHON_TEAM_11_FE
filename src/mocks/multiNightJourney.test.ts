import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { createMockMultiNightJourney } from './multiNightJourney';
import { complete, signal, settle, start } from './__tests__/nightHistory';
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});
function fixture() {
  let time = Date.parse('2026-11-16T21:30:00+09:00');
  const source = createMockMultiNightJourney({
    identity: { id: 'joined', email: 'joined@example.com' },
    clock: {
      now: () => time,
      advanceMorning: (date) => {
        time = Math.max(time, Date.parse(`${date}T04:00:00+09:00`) + 86400000);
      },
    },
  });
  return {
    source,
    setTime: (date: string) => {
      time = Date.parse(date);
    },
  };
}
it('keeps the registration, two nights and dated home actions after advancing to each morning', async () => {
  const { source, setTime } = fixture();
  const first = await complete(source.night, 3, '첫째 고민');
  source.advanceMorning();
  const snapshot1 = await settle(source.home.clock.load(signal()));
  const morning1 = source.home.resolveMorning!(snapshot1);
  await settle(morning1.reflection!.save(first.night_id, 'smaller', signal()));
  setTime('2026-11-17T21:00:00+09:00');
  source.enterNight();
  const second = await complete(source.night, 5, '둘째 고민');
  source.advanceMorning();
  const snapshot2 = await settle(source.home.clock.load(signal()));
  const morning2 = source.home.resolveMorning!(snapshot2);
  expect(morning2).not.toBe(morning1);
  expect((await settle(morning1.loadMorning(signal()))).night?.night_date).toBe(
    '2026-11-16',
  );
  expect((await settle(morning2.loadMorning(signal()))).night?.night_date).toBe(
    '2026-11-17',
  );
  expect(
    (await settle(source.home.settings!.loadMe(signal()))).user,
  ).toMatchObject({
    id: 'joined',
    email: 'joined@example.com',
    stats: { night_count: 2, counted_sheep_total: 8, worry_record_count: 2 },
  });
  expect(await settle(source.home.morning.loadFlock(signal()))).toEqual([
    second,
    first,
  ]);
  expect(
    (await settle(source.home.loadDetail!(first.id, signal()))).night.reflection
      ?.answer,
  ).toBe('smaller');
  setTime('2026-11-20T04:00:00+09:00');
  const noNight = source.home.resolveMorning!(
    await settle(source.home.clock.load(signal())),
  );
  expect((await settle(noNight.loadMorning(signal()))).night).toBeNull();
  expect(await settle(noNight.loadFlock(signal()))).toHaveLength(2);
});
it('keeps an earlier mornings writing and saved songs bound to that night while the new night starts', async () => {
  const { source, setTime } = fixture();
  await start(source.night, 5, '첫째 고민');
  source.night.progress({ position: 5, furthestPosition: 5 });
  await settle(source.night.songs.set('preview-card-3', true, signal()));
  await settle(
    source.night.closing.finish(
      { reason: 'completed', position: 5, furthestPosition: 5, sheepCount: 5 },
      'finish',
      signal(),
    ),
  );
  source.advanceMorning();
  const old = source.home.resolveMorning!(
      await settle(source.home.clock.load(signal())),
    ),
    id = (await settle(old.loadMorning(signal()))).night!.id;
  const draft = old.writing!.text.writeDraft({
    category_id: 'career',
    text: '첫째 밤에 미룬 글',
  });
  setTime('2026-11-17T21:00:00+09:00');
  source.enterNight();
  await complete(source.night, 3, '둘째 고민');
  source.advanceMorning();
  const current = source.home.resolveMorning!(
    await settle(source.home.clock.load(signal())),
  );
  expect(await settle(current.songs!.load(signal()))).toEqual([]);
  expect(
    (await settle(old.songs!.load(signal()))).map((s) => s.card_id),
  ).toEqual(['preview-card-3']);
  await settle(
    old.writing!.text.submit(
      {
        kind: 'text',
        category_id: 'career',
        content: { text: draft.text },
        source_night_id: id,
      },
      draft.operationKey,
      signal(),
    ),
  );
  expect((await settle(old.loadMorning(signal()))).writing_offer?.state).toBe(
    'fulfilled',
  );
  expect(
    (await settle(current.loadMorning(signal()))).writing_offer?.state,
  ).toBe('deferred');
  expect(
    (await settle(source.home.cards!.load({}, signal()))).items,
  ).toHaveLength(1);
});
it('does not replace a same-night paused session or rewind its clock on repeated morning transitions', async () => {
  const { source, setTime } = fixture();
  await start(source.night, 5);
  source.night.progress({ position: 2, furthestPosition: 3 });
  source.navigation.pause('feed');
  const night = source.night,
    nav = source.navigation;
  source.enterNight();
  expect(source.night).toBe(night);
  expect(source.navigation).toBe(nav);
  expect(source.night.getProgress()).toEqual({
    position: 2,
    furthestPosition: 3,
  });
  await settle(
    night.closing.finish(
      { reason: 'leave', position: 2, furthestPosition: 3, sheepCount: 5 },
      'leave',
      signal(),
    ),
  );
  source.advanceMorning();
  setTime('2026-11-17T10:00:00+09:00');
  source.advanceMorning();
  expect(
    Date.parse((await settle(source.home.clock.load(signal()))).server_time),
  ).toBeGreaterThanOrEqual(Date.parse('2026-11-17T10:00:00+09:00'));
});
it('refuses opening a night after the clock has crossed into daytime', () => {
  const { source, setTime } = fixture();
  const before = source.night;
  setTime('2026-11-17T04:00:00+09:00');
  expect(source.enterNight()).toBe(false);
  expect(source.night).toBe(before);
});
it('reconciles an unfinished night on the first daytime home read and keeps the next night separate', async () => {
  const { source, setTime } = fixture();
  await start(source.night, 5);
  source.night.progress({ position: 2, furthestPosition: 2 });
  setTime('2026-11-17T04:00:00+09:00');
  const morning = source.home.resolveMorning!(
    await settle(source.home.clock.load(signal())),
  );
  const value = await settle(morning.loadMorning(signal()));
  expect(value.counted_sheep).toBe(2);
  expect(value.candidate_cards).toHaveLength(2);
  expect(source.night.getRecord().expired).toBe(true);
  setTime('2026-11-17T21:00:00+09:00');
  expect(source.enterNight()).toBe(true);
  expect(source.night.getRecord().night).toBeNull();
  expect(source.history.getStats()).toEqual({
    night_count: 1,
    counted_sheep_total: 2,
    worry_record_count: 1,
  });
});

it('shares decoration across dated morning sources while keeping another account isolated', async () => {
  const { source, setTime } = fixture();
  const sheep = await complete(source.night, 3, '첫째 고민');
  source.advanceMorning();
  const old = source.home.resolveMorning!(
    await settle(source.home.clock.load(signal())),
  );
  const api = old.decoration!;
  const data = await settle(api.load(sheep.id, signal()));
  await settle(
    api.save(
      sheep.id,
      {
        if_version: data.sheep.version,
        placements: [
          {
            instance_id: 'my-star',
            sticker_id: 'st-1',
            x: 0.25,
            y: 0.75,
            rotation: 15,
            scale: 1,
          },
        ],
      },
      signal(),
    ),
  );
  setTime('2026-11-18T12:00:00+09:00');
  const next = source.home.resolveMorning!(
    await settle(source.home.clock.load(signal())),
  );
  expect(
    (await settle(next.loadFlock(signal()))).find((s) => s.id === sheep.id)
      ?.placements,
  ).toEqual([
    {
      instance_id: 'my-star',
      sticker_id: 'st-1',
      x: 0.25,
      y: 0.75,
      rotation: 15,
      scale: 1,
    },
  ]);
  expect(
    (await settle(source.home.loadDetail!(sheep.id, signal()))).sheep.version,
  ).toBe(2);
  const other = fixture();
  const otherSheep = await complete(other.source.night, 3, '다른 계정');
  other.source.advanceMorning();
  expect(
    (
      await settle(
        other.source.home.morning.decoration!.load(otherSheep.id, signal()),
      )
    ).sheep.placements,
  ).toEqual([]);
});

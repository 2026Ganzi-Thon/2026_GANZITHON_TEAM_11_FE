import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { createNightMorningDemo } from './nightMorningDemo';
import { finish, signal, settle, start } from './__tests__/nightHistory';
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});
it('does not reveal or newly entrust a worry erased from the same night', async () => {
  const d = createNightMorningDemo();
  await start(d, 7);
  d.progress({ position: 4, furthestPosition: 4 });
  d.worryRecords.eraseRecord(d.nightId);
  expect(d.entrust!.item.worry_text).toBe('');
  await expect(
    settle(d.entrust!.save('entrusted', signal())),
  ).rejects.toMatchObject({ code: 'WORRY_NOT_AVAILABLE' });
  expect((await settle(d.entrust!.save('skipped', signal()))).action).toBe(
    'skipped',
  );
});
it.each([
  [3, null],
  [6, null],
  [7, 4],
  [8, 4],
  [9, 5],
  [10, 5],
  [11, 6],
  [12, 6],
  [15, 6],
  [16, 6],
  [30, 6],
])(
  'reserves the specified entrust position in a %i-sheep night',
  async (count, position) => {
    const d = createNightMorningDemo();
    const cards = await start(d, count!);
    expect(cards).toHaveLength(count!);
    expect(d.entrust?.item.position ?? null).toBe(position);
    if (position !== null) expect(cards[position! - 1].content).toBeNull();
  },
);
it('never offers entrusting on a no-worry night', async () => {
  const d = createNightMorningDemo();
  await start(d, 30, null);
  expect(d.entrust).toBeUndefined();
});
it.each(['entrusted', 'skipped'] as const)(
  'keeps %s once across replay, finish and morning without offering the pause as a card',
  async (action) => {
    const d = createNightMorningDemo();
    await start(d, 7);
    d.progress({ position: 4, furthestPosition: 4 });
    const a = d.entrust!;
    expect(a.item.worry_text).toBe('첫째 밤의 고민');
    expect((await settle(a.load(signal()))).action).toBeNull();
    const saved = await settle(a.save(action, signal()));
    expect(await settle(a.save(action, signal()))).toEqual(saved);
    await expect(
      settle(
        a.save(action === 'entrusted' ? 'skipped' : 'entrusted', signal()),
      ),
    ).rejects.toMatchObject({ code: 'PAUSE_ALREADY_DECIDED' });
    expect((await settle(a.load(signal()))).action).toBe(action);
    d.progress({ position: 7, furthestPosition: 7 });
    expect((await finish(d, 7)).summary.entrusted_count).toBe(
      action === 'entrusted' ? 1 : 0,
    );
    d.advanceMorning();
    const morning = await settle(d.morning.loadMorning(signal()));
    expect(morning.counted_sheep).toBe(7);
    expect(morning.candidate_cards.map((c) => c.position).sort()).toEqual([
      1, 2, 3, 5, 6, 7,
    ]);
    expect(d.getRecord().night?.entrusted).toBe(action === 'entrusted');
    expect(
      (await settle(d.morning.reflection!.load(d.nightId, signal()))).night
        ?.entrusted,
    ).toBe(action === 'entrusted');
  },
);
it('requires the pause to be viewed and rejects card reactions to its placeholder', async () => {
  const d = createNightMorningDemo();
  await start(d, 7);
  await expect(
    settle(d.entrust!.save('entrusted', signal())),
  ).rejects.toMatchObject({ code: 'PAUSE_NOT_VIEWED' });
  d.progress({ position: 4, furthestPosition: 4 });
  await expect(
    settle(d.yarn.set('preview-card-4', true, signal())),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  await expect(
    settle(d.fluff.set('preview-card-4', true, signal())),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  await expect(
    settle(d.songs.set('preview-card-4', true, signal())),
  ).rejects.toMatchObject({ code: 'CARD_UNAVAILABLE' });
});
it('cancels before commit and does not entrust a worry after leaving the request', async () => {
  const d = createNightMorningDemo('entrust-slow');
  await start(d, 7);
  d.progress({ position: 4, furthestPosition: 4 });
  const c = new AbortController(),
    pending = d.entrust!.save('entrusted', c.signal);
  c.abort();
  await expect(pending).rejects.toMatchObject({ kind: 'aborted' });
  expect((await settle(d.entrust!.load(signal()))).action).toBeNull();
  expect(d.getRecord().night?.entrusted).toBe(false);
});
it('recovers a committed lost response with the same action without counting twice', async () => {
  const d = createNightMorningDemo('entrust-lost-response');
  await start(d, 7);
  d.progress({ position: 4, furthestPosition: 4 });
  await expect(
    settle(d.entrust!.save('entrusted', signal())),
  ).rejects.toMatchObject({ kind: 'network' });
  expect((await settle(d.entrust!.load(signal()))).action).toBe('entrusted');
  await settle(d.entrust!.save('entrusted', signal()));
  d.progress({ position: 7, furthestPosition: 7 });
  expect((await finish(d, 7)).summary.entrusted_count).toBe(1);
});

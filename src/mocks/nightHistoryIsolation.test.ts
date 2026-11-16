import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { createMockNightHistory } from './nightHistory';
import { complete, signal, settle } from './__tests__/nightHistory';
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});
it('deletes only one nights worry and reflection while keeping both sheep, cards and counted totals', async () => {
  const h = createMockNightHistory(),
    a = h.openNight('2026-11-16'),
    b = h.openNight('2026-11-17');
  const first = await complete(a.demo, 3, '첫째 고민'),
    second = await complete(b.demo, 3, '둘째 고민');
  await settle(a.morning.reflection!.save(a.demo.nightId, 'smaller', signal()));
  await settle(b.morning.reflection!.save(b.demo.nightId, 'bigger', signal()));
  await settle(h.deletions.records!.remove(a.demo.nightId, signal()));
  expect(
    (await h.worries.load({}, signal())).items.map((r) => r.night_id),
  ).toEqual([b.demo.nightId]);
  const firstDetail = await settle(h.loadSheep(first.id, signal()));
  expect(firstDetail.night).toMatchObject({
    worry_text: null,
    reflection: null,
  });
  expect(firstDetail.card.id).toBe(first.card_id);
  expect(firstDetail.card.available).toBe(true);
  expect((await settle(h.loadSheep(second.id, signal()))).night).toMatchObject({
    worry_text: '둘째 고민',
    reflection: { answer: 'bigger' },
  });
  expect(await h.loadFlock(signal())).toEqual([second, first]);
  expect(h.getStats()).toEqual({
    night_count: 2,
    counted_sheep_total: 6,
    worry_record_count: 1,
  });
  await expect(
    settle(a.morning.reflection!.save(a.demo.nightId, 'bigger', signal())),
  ).rejects.toMatchObject({ code: 'REFLECTION_NOT_AVAILABLE' });
});
it('keeps the saved answer on detail-only deletion and shares confirmation across both morning ports', async () => {
  const h = createMockNightHistory(),
    a = h.openNight('2026-11-16'),
    b = h.openNight('2026-11-17');
  const sheep = await complete(a.demo);
  await settle(a.morning.reflection!.save(a.demo.nightId, 'smaller', signal()));
  await settle(b.morning.worries!.remove(a.demo.nightId, signal()));
  expect(a.morning.worries!.isDeleted(a.demo.nightId)).toBe(true);
  expect((await settle(h.loadSheep(sheep.id, signal()))).night).toMatchObject({
    worry_text: null,
    reflection: { answer: 'smaller' },
  });
  expect((await h.worries.load({}, signal())).items).toEqual([]);
  expect(h.getStats()).toEqual({
    night_count: 1,
    counted_sheep_total: 3,
    worry_record_count: 0,
  });
});
it('confirms a lost deletion receipt without changing the other night or notifying twice', async () => {
  const h = createMockNightHistory({ deletionScenario: 'lost-response' }),
    a = h.openNight('2026-11-16'),
    b = h.openNight('2026-11-17');
  await complete(a.demo);
  await complete(b.demo, 3, '둘째 고민');
  const listener = jest.fn();
  h.deletions.subscribe(listener);
  await expect(
    settle(h.deletions.records!.remove(a.demo.nightId, signal())),
  ).rejects.toMatchObject({ kind: 'network' });
  expect(h.getStats().worry_record_count).toBe(1);
  expect(
    await settle(h.deletions.records!.check(a.demo.nightId, signal())),
  ).toBe(true);
  await settle(h.deletions.records!.remove(a.demo.nightId, signal()));
  expect(listener).toHaveBeenCalledTimes(1);
  expect(listener).toHaveBeenCalledWith(a.demo.nightId);
  expect((await h.worries.load({}, signal())).items[0].worry_text).toBe(
    '둘째 고민',
  );
});
it('returns independent snapshots for flock, detail and worry reads', async () => {
  const h = createMockNightHistory(),
    n = h.openNight('2026-11-16'),
    sheep = await complete(n.demo);
  const flock = await h.loadFlock(signal());
  flock[0].night_date = '1900-01-01';
  const detail = await settle(h.loadSheep(sheep.id, signal()));
  detail.night.worry_text = '외부 변경';
  detail.card.available = false;
  const worries = await h.worries.load({}, signal());
  worries.items[0].worry_text = '외부 변경';
  expect((await h.loadFlock(signal()))[0].night_date).toBe('2026-11-16');
  expect((await settle(h.loadSheep(sheep.id, signal()))).card.available).toBe(
    true,
  );
  expect((await h.worries.load({}, signal())).items[0].worry_text).toBe(
    '첫째 밤의 고민',
  );
  const canceled = new AbortController();
  const pending = h.loadSheep(sheep.id, canceled.signal);
  canceled.abort();
  await expect(settle(pending)).rejects.toMatchObject({ kind: 'aborted' });
  expect(jest.getTimerCount()).toBe(0);
});
it('keeps writing receipts and recovery keys distinct across nights and accounts', async () => {
  const h = createMockNightHistory({
      now: () => Date.parse('2026-11-18T04:00:00+09:00'),
    }),
    other = createMockNightHistory();
  const receipts = [];
  for (const date of ['2026-11-16', '2026-11-17']) {
    const n = h.openNight(date);
    await complete(n.demo);
    const actions = n.morning.writing!.text,
      text = `${date}에 쓴 글`;
    const draft = actions.writeDraft({ category_id: 'career', text });
    const body = {
      kind: 'text' as const,
      category_id: 'career' as const,
      content: { text },
      source_night_id: n.demo.nightId,
    };
    receipts.push(
      await settle(actions.submit(body, draft.operationKey, signal())),
    );
    await settle(actions.submit(body, draft.operationKey, signal()));
  }
  expect(new Set(receipts.map((r) => r.id)).size).toBe(2);
  const page = await settle(h.cards.load({}, signal()));
  expect(page.items).toHaveLength(2);
  expect(page.items.map((r) => r.created_at)).toEqual([
    '2026-11-17T19:00:00.000Z',
    '2026-11-17T19:00:00.000Z',
  ]);
  expect((await settle(other.cards.load({}, signal()))).items).toEqual([]);
  expect(await other.loadFlock(signal())).toEqual([]);
  expect(other.getStats().night_count).toBe(0);
});
it('continues a worry page after its cursor record has been deleted', async () => {
  const h = createMockNightHistory();
  for (let day = 1; day <= 21; day++) {
    const n = h.openNight(`2026-01-${String(day).padStart(2, '0')}`);
    await settle(
      n.demo.entry.checkWorry(
        { category_id: 'career', worry_text: `고민 ${day}` },
        signal(),
      ),
    );
  }
  const first = await h.worries.load({}, signal());
  expect(first.items).toHaveLength(20);
  expect(first.next_cursor).not.toBeNull();
  await settle(h.deletions.records!.remove(first.next_cursor!, signal()));
  const second = await h.worries.load({ cursor: first.next_cursor! }, signal());
  expect(second.items.map((r) => r.night_date)).toEqual(['2026-01-01']);
  expect(second.next_cursor).toBeNull();
});

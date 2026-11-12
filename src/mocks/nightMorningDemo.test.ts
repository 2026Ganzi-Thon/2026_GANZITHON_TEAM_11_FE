import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { createNightMorningDemo } from './nightMorningDemo';
import type { Card } from '../api/contracts';
const signal = () => new AbortController().signal;
async function settle<T>(p: Promise<T>) {
  await jest.runAllTimersAsync();
  return p;
}
afterEach(() => {
  jest.useRealTimers();
});
describe('one-night demo records', () => {
  it('carries the actual worry, count, viewed card, adoption and reflection through one night', async () => {
    jest.useFakeTimers();
    const d = createNightMorningDemo();
    await settle(
      d.entry.checkWorry(
        { category_id: 'study', worry_text: '내일 시험이 걱정돼요.' },
        signal(),
      ),
    );
    await settle(d.entry.startCounting(5, signal()));
    const cards = await settle(d.loadFeed(signal()));
    expect(cards).toHaveLength(5);
    d.progress({ position: 3, furthestPosition: 3 });
    d.progress({ position: 2, furthestPosition: 3 });
    const request = {
      reason: 'leave' as const,
      position: 2,
      furthestPosition: 3,
      sheepCount: 5,
    };
    const finish = await settle(d.closing.finish(request, 'op1', signal()));
    expect(finish.summary.counted).toBe(3);
    await settle(
      d.closing.markViewed(finish.closing_card!.id, 'view1', signal()),
    );
    d.advanceMorning();
    const morning = await settle(d.morning.loadMorning(signal()));
    expect(morning.counted_sheep).toBe(3);
    expect(morning.candidate_cards).toHaveLength(4);
    const card = cards[1];
    const sheep = await settle(d.morning.adopt(d.nightId, card.id, signal()));
    const again = await settle(d.morning.adopt(d.nightId, card.id, signal()));
    expect(again.id).toBe(sheep.id);
    const reflection = await settle(
      d.morning.reflection.save(d.nightId, 'bigger', signal()),
    );
    const detail = await settle(d.morning.loadSheep(sheep.id, signal()));
    expect(detail.card).toEqual(card);
    expect(detail.position).toBe(2);
    expect(detail.sheep_count).toBe(5);
    expect(detail.night.worry_text).toBe('내일 시험이 걱정돼요.');
    expect(detail.night.category_id).toBe('study');
    expect(detail.night.reflection).toEqual(reflection);
    expect(await settle(d.morning.loadFlock(signal()))).toHaveLength(1);
  });
  it('does not count downloaded unseen cards and excludes an unseen closing card', async () => {
    jest.useFakeTimers();
    const d = createNightMorningDemo();
    await settle(
      d.entry.checkWorry({ category_id: 'none', worry_text: null }, signal()),
    );
    await settle(d.entry.startCounting(10, signal()));
    await settle(d.loadFeed(signal()));
    await settle(
      d.closing.finish(
        { reason: 'leave', position: 1, furthestPosition: 1, sheepCount: 10 },
        'op',
        signal(),
      ),
    );
    d.advanceMorning();
    const m = await settle(d.morning.loadMorning(signal()));
    expect(m.counted_sheep).toBe(1);
    expect(m.candidate_cards).toHaveLength(1);
    const read = await settle(d.morning.reflection.load(d.nightId, signal()));
    expect(read.night?.worry_text).toBeNull();
    expect(read.night?.category_id).toBe('none');
    const failure = expect(
      d.morning.reflection.save(d.nightId, 'same', signal()),
    ).rejects.toMatchObject({ code: 'REFLECTION_NOT_AVAILABLE' });
    await jest.runAllTimersAsync();
    await failure;
  });
  it('replays lost finish and adoption responses without duplicating records', async () => {
    jest.useFakeTimers();
    const d = createNightMorningDemo('lost-responses');
    await settle(
      d.entry.checkWorry(
        { category_id: 'career', worry_text: '기다리는 중' },
        signal(),
      ),
    );
    await settle(d.entry.startCounting(3, signal()));
    const cards: Card[] = await settle(d.loadFeed(signal()));
    d.progress({ position: 3, furthestPosition: 3 });
    const request = {
      reason: 'completed' as const,
      position: 3,
      furthestPosition: 3,
      sheepCount: 3,
    };
    let failure = expect(
      d.closing.finish(request, 'op1', signal()),
    ).rejects.toMatchObject({ kind: 'network' });
    await jest.runAllTimersAsync();
    await failure;
    const finish = await settle(d.closing.finish(request, 'op2', signal()));
    expect(finish.summary.counted).toBe(3);
    d.advanceMorning();
    failure = expect(
      d.morning.adopt(d.nightId, cards[2].id, signal()),
    ).rejects.toMatchObject({ kind: 'network' });
    await jest.runAllTimersAsync();
    await failure;
    await settle(d.morning.adopt(d.nightId, cards[2].id, signal()));
    expect(await settle(d.morning.loadFlock(signal()))).toHaveLength(1);
  });
  it('retains progress on reload and rejects changing an active session or advancing too early', async () => {
    jest.useFakeTimers();
    const d = createNightMorningDemo();
    expect(() => d.advanceMorning()).toThrow();
    await settle(
      d.entry.checkWorry(
        { category_id: 'career', worry_text: '기록' },
        signal(),
      ),
    );
    await settle(d.entry.startCounting(4, signal()));
    await settle(d.loadFeed(signal()));
    d.progress({ position: 2, furthestPosition: 3 });
    expect(d.getProgress()).toEqual({ position: 2, furthestPosition: 3 });
    await settle(d.loadFeed(signal()));
    expect(d.getProgress().furthestPosition).toBe(3);
    const failure = expect(
      d.entry.startCounting(5, signal()),
    ).rejects.toThrow();
    await jest.runAllTimersAsync();
    await failure;
  });
  it('cancels a pending start without creating a session and clears its timer', async () => {
    jest.useFakeTimers();
    const d = createNightMorningDemo();
    await settle(
      d.entry.checkWorry(
        { category_id: 'career', worry_text: '기록' },
        signal(),
      ),
    );
    const controller = new AbortController();
    const failure = expect(
      d.entry.startCounting(3, controller.signal),
    ).rejects.toMatchObject({ kind: 'aborted' });
    controller.abort();
    await failure;
    expect(jest.getTimerCount()).toBe(0);
    await settle(d.entry.startCounting(4, signal()));
    expect(await settle(d.loadFeed(signal()))).toHaveLength(4);
  });
});

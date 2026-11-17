import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { createMockReceivedYarnInbox } from './receivedYarnInbox';
import { createMockMyCards } from './myCards';
import { settle, signal } from './__tests__/nightHistory';
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});
function fixture(scenario: 'success' | 'seen-lost' | 'seen-retry' = 'success') {
  let now = Date.parse('2026-11-16T21:00:00+09:00');
  const cards = createMockMyCards('empty', { now: () => now });
  cards.seedPublishedText('a', '첫 카드');
  cards.seedPublishedText('b', '둘째 카드');
  const inbox = createMockReceivedYarnInbox({
    ownerId: 'owner',
    now: () => now,
    cards,
    scenario,
  });
  return {
    cards,
    inbox,
    set: (value: string) => {
      now = Date.parse(value);
    },
  };
}
it('aggregates the previous 04:00 window, counting distinct people across cards and matching owned-card totals', async () => {
  const f = fixture();
  f.inbox.receive({
    id: '1',
    cardId: 'a',
    senderKey: 'person-1',
    receivedAt: Date.parse('2026-11-16T21:00:00+09:00'),
  });
  f.inbox.receive({
    id: '2',
    cardId: 'a',
    senderKey: 'person-2',
    receivedAt: Date.parse('2026-11-17T03:59:59+09:00'),
  });
  f.inbox.receive({
    id: '3',
    cardId: 'b',
    senderKey: 'person-1',
    receivedAt: Date.parse('2026-11-17T03:59:59+09:00'),
  });
  f.set('2026-11-17T03:59:59+09:00');
  expect(await settle(f.inbox.forDate('2026-11-16').load(signal()))).toBeNull();
  f.set('2026-11-17T04:00:00+09:00');
  const port = f.inbox.forDate('2026-11-17');
  expect(await settle(port.load(signal()))).toEqual({
    id: 'owner:2026-11-17',
    date: '2026-11-17',
    yarn_count: 3,
    sender_count: 2,
  });
  const items = (await settle(f.cards.load({}, signal()))).items;
  expect(items.find((i) => i.id === 'a')?.yarn_count).toBe(2);
  expect(items.find((i) => i.id === 'b')?.yarn_count).toBe(1);
  expect(f.inbox.forDate('2026-11-17')).toBe(port);
});
it('does not include a reaction at 04:00 until the next morning, and manual reads do not suppress automatic presentation', async () => {
  const f = fixture();
  f.set('2026-11-17T04:00:00+09:00');
  f.inbox.receive({
    id: 'boundary',
    cardId: 'a',
    senderKey: 'p',
    receivedAt: Date.parse('2026-11-17T04:00:00+09:00'),
  });
  expect(
    await settle(f.inbox.forDate('2026-11-17').loadLatest!(signal())),
  ).toBeNull();
  f.set('2026-11-18T04:00:00+09:00');
  const port = f.inbox.forDate('2026-11-18');
  expect((await settle(port.loadLatest!(signal())))?.yarn_count).toBe(1);
  expect((await settle(port.load(signal())))?.yarn_count).toBe(1);
  await settle(port.markSeen('owner:2026-11-18', signal()));
  expect(await settle(port.load(signal()))).toBeNull();
  expect((await settle(port.loadLatest!(signal())))?.yarn_count).toBe(1);
});
it('deduplicates receipt and sender/card pairs and excludes deleted or unpublished cards', async () => {
  const f = fixture();
  const event = {
    id: 'same',
    cardId: 'a',
    senderKey: 'person',
    receivedAt: Date.parse('2026-11-16T22:00:00+09:00'),
  };
  f.inbox.receive(event);
  f.inbox.receive(event);
  f.inbox.receive({ ...event, id: 'repeat' });
  expect(() =>
    f.inbox.receive({ ...event, id: 'other', cardId: 'missing' }),
  ).toThrow();
  f.set('2026-11-17T04:00:00+09:00');
  expect(
    (await settle(f.inbox.forDate('2026-11-17').load(signal())))?.yarn_count,
  ).toBe(1);
  await settle(f.cards.remove('a', signal()));
  expect(
    await settle(f.inbox.forDate('2026-11-17').loadLatest!(signal())),
  ).toBeNull();
});
it('recovers an uncertain seen write while keeping manual access and account isolation', async () => {
  const f = fixture('seen-lost');
  f.inbox.receive({
    id: '1',
    cardId: 'a',
    senderKey: 'p',
    receivedAt: Date.parse('2026-11-16T22:00:00+09:00'),
  });
  f.set('2026-11-17T05:00:00+09:00');
  const port = f.inbox.forDate('2026-11-17');
  await expect(
    settle(port.markSeen('owner:2026-11-17', signal())),
  ).rejects.toMatchObject({ kind: 'network' });
  expect(await settle(port.load(signal()))).toBeNull();
  expect((await settle(port.loadLatest!(signal())))?.yarn_count).toBe(1);
  await settle(port.markSeen('owner:2026-11-17', signal()));
  const other = createMockReceivedYarnInbox({
    ownerId: 'other',
    now: () => Date.parse('2026-11-17T05:00:00+09:00'),
    cards: createMockMyCards('empty'),
  });
  expect(await settle(other.forDate('2026-11-17').load(signal()))).toBeNull();
  f.set('2026-11-18T04:00:00+09:00');
  expect(await settle(port.loadLatest!(signal()))).toBeNull();
  await expect(
    settle(port.markSeen('owner:2026-11-17', signal())),
  ).rejects.toMatchObject({ code: 'YARN_SUMMARY_DATE_CHANGED' });
});
it('remembers a displayed popup separately from a failed acknowledgement so home re-entry stays quiet', async () => {
  const f = fixture('seen-retry');
  f.inbox.receive({
    id: '1',
    cardId: 'a',
    senderKey: 'p',
    receivedAt: Date.parse('2026-11-16T22:00:00+09:00'),
  });
  f.set('2026-11-17T05:00:00+09:00');
  const port = f.inbox.forDate('2026-11-17');
  await expect(
    settle(port.markSeen('owner:2026-11-17', signal())),
  ).rejects.toMatchObject({ kind: 'network' });
  expect(await settle(port.load(signal()))).toBeNull();
  expect((await settle(port.loadLatest!(signal())))?.yarn_count).toBe(1);
  await settle(port.markSeen('owner:2026-11-17', signal()));
});
it('keeps the displayed flag when acknowledgement is cancelled, but ignores pre-cancelled presentation attempts', async () => {
  const f = fixture();
  f.inbox.receive({
    id: '1',
    cardId: 'a',
    senderKey: 'p',
    receivedAt: Date.parse('2026-11-16T22:00:00+09:00'),
  });
  f.set('2026-11-17T05:00:00+09:00');
  const port = f.inbox.forDate('2026-11-17');
  const pre = new AbortController();
  pre.abort();
  await expect(
    port.markSeen('owner:2026-11-17', pre.signal),
  ).rejects.toMatchObject({ kind: 'aborted' });
  expect((await settle(port.load(signal())))?.yarn_count).toBe(1);
  const c = new AbortController();
  const pending = port.markSeen('owner:2026-11-17', c.signal);
  c.abort();
  await expect(pending).rejects.toMatchObject({ kind: 'aborted' });
  expect(await settle(port.load(signal()))).toBeNull();
  expect((await settle(port.loadLatest!(signal())))?.yarn_count).toBe(1);
});

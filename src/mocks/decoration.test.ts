import { beforeEach, afterEach, expect, it, jest } from '@jest/globals';
import { createMockDecoration } from './decoration';
import type { SheepDetailLoad } from '../features/flock/types';
const load: SheepDetailLoad = async (id) => ({
  sheep: {
    id,
    night_id: 'n',
    night_date: '2026-11-16',
    card_id: 'c',
    color_key: null,
  },
  card: {
    id: 'c',
    kind: 'text',
    available: true,
    category_id: null,
    tone: 'warm',
    author_type: 'seed',
    author_label: '예시 양',
    viewer: { yarn_sent: false, fluff_saved: false, song_saved: false },
    content: { text: '잠깐 쉬어 가요.' },
  },
  position: 1,
  sheep_count: 5,
  night: {
    night_date: '2026-11-16',
    worry_text: null,
    category_id: 'none',
    reflection: null,
  },
});
const placement = {
  instance_id: 'p',
  sticker_id: 'st-1',
  x: 0.5,
  y: 0.5,
  rotation: 0,
  scale: 1,
};
let now = Date.parse('2026-11-17T12:00:00+09:00');
const signal = () => new AbortController().signal;
async function settle<T>(p: Promise<T>) {
  const value = p.then(
    (v) => ({ value: v }),
    (error) => ({ error }),
  );
  await jest.runOnlyPendingTimersAsync();
  const r = await value;
  if ('error' in r) throw r.error;
  return r.value;
}
beforeEach(() => {
  jest.useFakeTimers();
  now = Date.parse('2026-11-17T12:00:00+09:00');
});
afterEach(() => {
  jest.useRealTimers();
});
it('stores a full replacement for one sheep without changing another sheep or caller objects', async () => {
  const api = createMockDecoration(load, { now: () => now });
  const a = await settle(api.load('a', signal()));
  expect(a.stickers).toHaveLength(7);
  const saved = await settle(
    api.save('a', { if_version: 1, placements: [placement] }, signal()),
  );
  expect(saved.version).toBe(2);
  expect(saved.placements).toEqual([placement]);
  saved.placements[0].x = 0;
  expect((await settle(api.load('a', signal()))).sheep.placements[0].x).toBe(
    0.5,
  );
  expect((await settle(api.load('b', signal()))).sheep.placements).toEqual([]);
  expect(
    (await settle(api.save('a', { if_version: 2, placements: [] }, signal())))
      .placements,
  ).toEqual([]);
});
it('recovers a committed but lost response by reading instead of duplicating a save', async () => {
  const api = createMockDecoration(load, {
    now: () => now,
    scenario: 'save-lost',
  });
  await expect(
    settle(api.save('a', { if_version: 1, placements: [placement] }, signal())),
  ).rejects.toMatchObject({ kind: 'network' });
  expect((await settle(api.load('a', signal()))).sheep).toMatchObject({
    version: 2,
    placements: [placement],
  });
  await expect(
    settle(api.save('a', { if_version: 1, placements: [] }, signal())),
  ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
});
it.each(['2026-11-17T03:59:59+09:00', '2026-11-17T21:00:00+09:00'])(
  'rejects edits outside daytime at completion %s',
  async (date) => {
    const api = createMockDecoration(load, { now: () => now });
    const p = api.save(
      'a',
      { if_version: 1, placements: [placement] },
      signal(),
    );
    now = Date.parse(date);
    await expect(settle(p)).rejects.toMatchObject({ code: 'DAY_ONLY' });
    expect((await settle(api.load('a', signal()))).sheep.placements).toEqual(
      [],
    );
  },
);
it('does not commit an aborted request and clears its owned timer', async () => {
  const api = createMockDecoration(load, { now: () => now });
  const c = new AbortController();
  const p = api.save('a', { if_version: 1, placements: [placement] }, c.signal);
  const failed = expect(p).rejects.toMatchObject({ kind: 'aborted' });
  c.abort();
  await failed;
  expect(jest.getTimerCount()).toBe(0);
  expect((await settle(api.load('a', signal()))).sheep.version).toBe(1);
});

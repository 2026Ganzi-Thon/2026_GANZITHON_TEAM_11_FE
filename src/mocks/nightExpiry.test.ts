import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { createNightMorningDemo } from './nightMorningDemo';
import { signal, settle, start, finish } from './__tests__/nightHistory';
const closesAt = '2026-11-17T04:00:00+09:00';
function fixture(
  scenario: Parameters<typeof createNightMorningDemo>[0] = 'success',
  extra = {},
) {
  const expiry = { now: () => Date.now(), closesAt, ...extra };
  return createNightMorningDemo(scenario, { nightDate: '2026-11-16', expiry });
}
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-11-17T03:59:30+09:00'));
});
afterEach(() => {
  jest.useRealTimers();
});
it('expires a partial night using only confirmed progress and excludes an unseen closing card', async () => {
  const d = fixture();
  await start(d, 5);
  d.progress({ position: 1, furthestPosition: 2 });
  jest.setSystemTime(new Date(closesAt));
  const m = await settle(d.morning.loadMorning(signal()));
  expect(d.getRecord()).toMatchObject({
    expired: true,
    finished: true,
    morningOpen: true,
    counted: 2,
  });
  expect(m.counted_sheep).toBe(2);
  expect(m.candidate_cards.map((c) => c.position)).toEqual([1, 2]);
  expect(m.writing_offer?.state).toBe('deferred');
  expect(d.getSession()?.furthestPosition).toBe(2);
  const first = await settle(
    d.morning.adopt(d.nightId, m.default_card_id!, signal()),
  );
  expect(
    await settle(d.morning.adopt(d.nightId, m.default_card_id!, signal())),
  ).toEqual(first);
});
it('does not turn downloaded but unseen cards into counted sheep or adoption candidates', async () => {
  const d = fixture();
  await start(d, 5);
  jest.setSystemTime(new Date(closesAt));
  const m = await settle(d.morning.loadMorning(signal()));
  expect(m.counted_sheep).toBe(0);
  expect(m.candidate_cards).toEqual([]);
  expect(m.default_card_id).toBeNull();
  expect(d.getSession()?.furthestPosition).toBe(0);
  expect(await settle(d.morning.loadFlock(signal()))).toEqual([]);
});
it('opens an empty morning for a worry-only night without inventing a session', async () => {
  const d = fixture();
  await settle(
    d.entry.checkWorry(
      { category_id: 'career', worry_text: '고민만 적었어요' },
      signal(),
    ),
  );
  jest.setSystemTime(new Date(closesAt));
  const m = await settle(d.morning.loadMorning(signal()));
  expect(d.getSession()).toBeNull();
  expect(m.night).toBeNull();
  expect(m.candidate_cards).toEqual([]);
  expect(d.getRecord().night?.worry_text).toBe('고민만 적었어요');
});
it.each([
  'worry',
  'start',
  'feed',
  'finish',
  'fluff',
  'song',
  'view',
  'choice',
] as const)(
  'rejects a late %s commit and keeps the last confirmed snapshot',
  async (kind) => {
    const d = fixture();
    await start(d, 5);
    d.progress({ position: 2, furthestPosition: 3 });
    let closingId = '';
    if (kind === 'view' || kind === 'choice') {
      const result = await settle(
        d.closing.finish(
          { reason: 'leave', position: 2, furthestPosition: 3, sheepCount: 5 },
          'leave',
          signal(),
        ),
      );
      closingId = result.closing_card!.id;
    }
    jest.setSystemTime(new Date('2026-11-17T03:59:59.900+09:00'));
    const request =
      kind === 'worry'
        ? d.entry.checkWorry(
            { category_id: 'study', worry_text: '늦은 수정' },
            signal(),
          )
        : kind === 'start'
          ? d.entry.startCounting(5, signal())
          : kind === 'feed'
            ? d.loadFeed(signal())
            : kind === 'finish'
              ? d.closing.finish(
                  {
                    reason: 'leave',
                    position: 2,
                    furthestPosition: 3,
                    sheepCount: 5,
                  },
                  'late',
                  signal(),
                )
              : kind === 'fluff'
                ? d.fluff.set('preview-card-1', true, signal())
                : kind === 'song'
                  ? d.songs.set('preview-card-3', true, signal())
                  : kind === 'view'
                    ? d.closing.markViewed(closingId, 'view', signal())
                    : d.closing.chooseWriting('now', 'choice', signal());
    await expect(settle<unknown>(request)).rejects.toMatchObject({
      code:
        kind === 'fluff' || kind === 'song' ? 'NIGHT_CLOSED' : 'SESSION_CLOSED',
    });
    d.progress({ position: 5, furthestPosition: 5 });
    expect(d.getSession()?.furthestPosition).toBe(3);
    expect(d.getRecord().night?.category_id).toBe('career');
  },
);
it('recovers a committed finish after response loss without marking it as expired or losing a fulfilled offer', async () => {
  const d = fixture('lost-responses');
  await start(d, 3);
  d.progress({ position: 3, furthestPosition: 3 });
  await expect(finish(d, 3)).rejects.toMatchObject({ kind: 'network' });
  await settle(d.closing.chooseWriting('now', 'write', signal()));
  const actions = d.cardWriting.text,
    draft = actions.writeDraft({ category_id: 'career', text: '확인된 접수' });
  await settle(
    actions.submit(
      {
        kind: 'text',
        category_id: 'career',
        content: { text: draft.text },
        source_night_id: d.nightId,
      },
      draft.operationKey,
      signal(),
    ),
  );
  jest.setSystemTime(new Date(closesAt));
  const m = await settle(d.morning.loadMorning(signal()));
  expect(d.getRecord().expired).toBe(false);
  expect(m.counted_sheep).toBe(3);
  expect(m.writing_offer?.state).toBe('fulfilled');
  expect((await finish(d, 3)).summary.counted).toBe(3);
});
it('does not acknowledge a first feed download whose response reaches the deadline', async () => {
  const d = fixture();
  await settle(
    d.entry.checkWorry(
      { category_id: 'career', worry_text: '아직 못 본 밤' },
      signal(),
    ),
  );
  await settle(d.entry.startCounting(5, signal()));
  jest.setSystemTime(new Date('2026-11-17T03:59:59.500+09:00'));
  await expect(settle(d.loadFeed(signal()))).rejects.toMatchObject({
    code: 'SESSION_CLOSED',
  });
  const morning = await settle(d.morning.loadMorning(signal()));
  expect(morning.candidate_cards).toEqual([]);
  expect(d.getSession()?.furthestPosition).toBe(0);
});
it('returns a consistent clock snapshot even when the clock crosses 04:00 during the response', async () => {
  let reads = 0;
  const end = Date.parse(closesAt);
  const d = createNightMorningDemo('success', {
    expiry: { now: () => end + (reads++ ? 1 : -1), closesAt },
  });
  const value = await settle(d.expiry!.load(signal()));
  expect(value.closed).toBe(Date.parse(value.server_time) >= end);
});

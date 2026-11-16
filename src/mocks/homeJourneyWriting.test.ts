import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { createMockHomeJourney } from './homeJourney';
const signal = () => new AbortController().signal;
async function settle<T>(promise: Promise<T>) {
  await jest.runAllTimersAsync();
  return promise;
}
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});
async function finish(source: ReturnType<typeof createMockHomeJourney>) {
  const d = source.night;
  await settle(
    d.entry.checkWorry(
      { category_id: 'career', worry_text: '면접 걱정' },
      signal(),
    ),
  );
  await settle(d.entry.startCounting(3, signal()));
  await settle(d.loadFeed(signal()));
  d.progress({ position: 3, furthestPosition: 3 });
  await settle(
    d.closing.finish(
      { reason: 'completed', position: 3, furthestPosition: 3, sheepCount: 3 },
      'finish',
      signal(),
    ),
  );
}
it.each(['text', 'song'] as const)(
  'shares a %s submission with my cards after a lost night or morning receipt, keeping it out of candidates',
  async (kind) => {
    const source = createMockHomeJourney('writing-lost-response'),
      d = source.night;
    await finish(source);
    if (kind === 'text')
      await settle(d.closing.chooseWriting('now', 'now', signal()));
    else {
      await settle(d.closing.chooseWriting('morning', 'later', signal()));
      source.advanceMorning();
    }
    const body =
      kind === 'text'
        ? {
            kind: 'text' as const,
            category_id: 'career' as const,
            content: { text: '오늘은 쉬어도 괜찮아' },
            source_night_id: d.nightId,
          }
        : {
            kind: 'song' as const,
            category_id: 'career' as const,
            content: {
              manual_track: { title: '쉬는 밤', artist: '예시 가수' },
              recommendation: '오늘은 쉬어도 괜찮아',
            },
            source_night_id: d.nightId,
          };
    const submit = async () =>
      body.kind === 'text'
        ? d.textCards.submit(body, 'write-once', signal())
        : d.cardWriting.song.submit(body, 'write-once', signal());
    const failed = expect(submit()).rejects.toMatchObject({ kind: 'network' });
    await jest.runAllTimersAsync();
    await failed;
    const before = await settle(source.home.cards!.load({}, signal()));
    expect(before.items).toHaveLength(1);
    const receipt = await settle(submit());
    const pending = (
      await settle(source.home.cards!.load({ status: 'pending' }, signal()))
    ).items;
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject(receipt);
    expect(d.getRecord().finished).toBe(true);
    source.advanceMorning();
    const morning = await settle(source.home.morning.loadMorning(signal()));
    expect(morning.writing_offer?.state).toBe('fulfilled');
    expect(
      morning.candidate_cards.some((item) => item.card.id === receipt.id),
    ).toBe(false);
    await settle(source.home.cards!.remove(receipt.id, signal()));
    await settle(submit());
    expect((await settle(source.home.cards!.load({}, signal()))).items).toEqual(
      [],
    );
  },
);

it('keeps free my-card writing separate from the deferred night offer and both records in one list', async () => {
  const source = createMockHomeJourney();
  await finish(source);
  await settle(
    source.night.closing.chooseWriting('morning', 'defer', signal()),
  );
  source.advanceMorning();
  const writer = source.home.cards!.createWritingSession();
  const own = await settle(
    writer.text.submit(
      {
        kind: 'text',
        category_id: 'study',
        content: { text: '내 카드에서 쓴 다른 경험' },
      },
      'own',
      signal(),
    ),
  );
  expect(
    (await settle(source.home.morning.loadMorning(signal()))).writing_offer
      ?.state,
  ).toBe('deferred');
  const night = await settle(
    source.night.textCards.submit(
      {
        kind: 'text',
        category_id: 'career',
        content: { text: '밤에 미뤄 둔 경험' },
        source_night_id: source.night.nightId,
      },
      'night',
      signal(),
    ),
  );
  expect(night.id).not.toBe(own.id);
  const items = (await settle(source.home.cards!.load({}, signal()))).items;
  expect(new Set(items.map((item) => item.id))).toEqual(
    new Set([night.id, own.id]),
  );
  expect(
    (await settle(source.home.morning.loadMorning(signal()))).writing_offer
      ?.state,
  ).toBe('fulfilled');
});

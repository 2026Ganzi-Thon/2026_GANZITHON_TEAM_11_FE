import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { createMockMyCards } from './myCards';
import type { TextCardSubmission } from '../features/cards/types';
import type { SongCardSubmission } from '../features/cards/songTypes';
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
const text = (): TextCardSubmission => ({
  id: 'night-writing-text',
  kind: 'text',
  category_id: 'career',
  content: { text: '오늘은 잠깐 쉬어요' },
  moderation_status: 'pending',
});
const song = (): SongCardSubmission => ({
  id: 'night-writing-song',
  kind: 'song',
  category_id: 'study',
  content: {
    track: {
      id: 'manual',
      title: '쉬는 밤',
      artist: '예시 가수',
      cover_url: null,
      spotify_search_url: '',
    },
    recommendation: '함께 쉬어가요',
  },
  moderation_status: 'pending',
});
it.each([text, song])(
  'copies accepted writing into the shared list once without exposing mutable content',
  async (receipt) => {
    const source = createMockMyCards('empty', {
        now: () => Date.parse('2026-11-16T21:30:00+09:00'),
      }),
      item = receipt();
    source.acceptSubmission(item);
    source.acceptSubmission(item);
    if (item.kind === 'text') item.content.text = '외부에서 바뀐 본문';
    else item.content.track.title = '외부에서 바뀐 제목';
    const first = await settle(source.load({ status: 'pending' }, signal()));
    expect(first.items).toHaveLength(1);
    expect(first.items[0]).toMatchObject({
      ...receipt(),
      created_at: '2026-11-16T12:30:00.000Z',
      revision: 1,
      yarn_count: 0,
      rejection_reason: null,
    });
    const row = first.items[0];
    if (row.kind === 'text') row.content.text = '조회 참조 변경';
    else row.content.track.title = '조회 참조 변경';
    expect((await settle(source.load({}, signal()))).items[0].content).toEqual(
      receipt().content,
    );
    await settle(source.remove(item.id, signal()));
    source.acceptSubmission(receipt());
    expect((await settle(source.load({}, signal()))).items).toEqual([]);
  },
);
it('keeps a resubmitted record pending when an old rejected receipt is delivered again', async () => {
  const source = createMockMyCards();
  const item = (await settle(source.load({ status: 'rejected' }, signal())))
    .items[0];
  if (item.kind !== 'text') throw new Error('Expected rejected text');
  await settle(
    source.resubmit(
      item.id,
      {
        kind: 'text',
        category_id: 'career',
        content: { text: '고쳐 쓴 경험' },
      },
      'resubmit-once',
      signal(),
    ),
  );
  source.acceptSubmission({
    id: item.id,
    kind: 'text',
    category_id: 'career',
    content: { text: '처음 접수 본문' },
    moderation_status: 'pending',
  });
  const updated = (
    await settle(source.load({ status: 'pending' }, signal()))
  ).items.find((row) => row.id === item.id);
  expect(updated).toMatchObject({
    content: { text: '고쳐 쓴 경험' },
    revision: 2,
    rejection_reason: null,
  });
});
it('isolates accounts and keeps independent my-card writing IDs apart from a night submission', async () => {
  const a = createMockMyCards('empty'),
    b = createMockMyCards('empty');
  a.acceptSubmission(text());
  const writer = a.createWritingSession();
  const receipt = await settle(
    writer.text.submit(
      {
        kind: 'text',
        category_id: 'career',
        content: { text: '내 카드에서 새로 작성' },
      },
      'new-own-card',
      signal(),
    ),
  );
  expect(receipt.id).not.toBe(text().id);
  expect((await settle(a.load({}, signal()))).items).toHaveLength(2);
  expect((await settle(b.load({}, signal()))).items).toHaveLength(0);
});

import { expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import type { MyCardsActions, SubmissionPage } from './types';
import { useMyCards } from './useMyCards';

const item = (id: string) => ({
  id,
  kind: 'text' as const,
  category_id: 'study',
  content: { text: id },
  moderation_status: 'pending' as const,
  rejection_reason: null,
  yarn_count: 0,
  created_at: '2026-11-07T01:00:00Z',
  revision: 1,
});
function deferred() {
  let resolve!: (page: SubmissionPage) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<SubmissionPage>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
it('appends unique cards and blocks repeated load-more presses while pending', async () => {
  const next = deferred();
  const load = jest
    .fn<MyCardsActions['load']>()
    .mockResolvedValueOnce({ items: [item('a')], next_cursor: 'page-2' })
    .mockReturnValueOnce(next.promise);
  const actions = { load };
  const { result } = await renderHook(() => useMyCards(actions, 'all'));
  await act(async () => {
    result.current.loadMore();
    result.current.loadMore();
  });
  expect(load).toHaveBeenCalledTimes(2);
  expect(load.mock.calls[1][0]).toEqual({ cursor: 'page-2' });
  expect(result.current.items.map((card) => card.id)).toEqual(['a']);
  await act(async () =>
    next.resolve({ items: [item('a'), item('b')], next_cursor: null }),
  );
  expect(result.current.items.map((card) => card.id)).toEqual(['a', 'b']);
  expect(result.current.hasMore).toBe(false);
});
it('keeps confirmed rows on page failure and retries the same cursor', async () => {
  const actions: MyCardsActions = {
    load: jest
      .fn<MyCardsActions['load']>()
      .mockResolvedValueOnce({ items: [item('a')], next_cursor: 'page-2' })
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ items: [item('b')], next_cursor: null }),
  };
  const { result } = await renderHook(() => useMyCards(actions, 'pending'));
  await act(async () => result.current.loadMore());
  expect(result.current.items.map((card) => card.id)).toEqual(['a']);
  expect(result.current.error).toBe('more');
  await act(async () => result.current.retry());
  expect(actions.load).toHaveBeenLastCalledWith(
    { status: 'pending', cursor: 'page-2' },
    expect.any(AbortSignal),
  );
  expect(result.current.items.map((card) => card.id)).toEqual(['a', 'b']);
  expect(result.current.error).toBeNull();
});
it.each(['resolve', 'reject'] as const)(
  'ignores an old filter %s even if abort is not honored',
  async (outcome) => {
    const old = deferred();
    const load = jest
      .fn<MyCardsActions['load']>()
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce({ items: [], next_cursor: null });
    const actions = { load };
    const { result, rerender } = await renderHook(
      ({ filter }: { filter: 'all' | 'rejected' }) =>
        useMyCards(actions, filter),
      { initialProps: { filter: 'all' } },
    );
    await rerender({ filter: 'rejected' });
    expect(load.mock.calls[0][1].aborted).toBe(true);
    expect(load.mock.calls[1][0]).toEqual({ status: 'rejected' });
    await act(async () => {
      if (outcome === 'resolve')
        old.resolve({ items: [item('old')], next_cursor: 'old-cursor' });
      else old.reject(new Error('late failure'));
    });
    expect(result.current.items).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.hasMore).toBe(false);
  },
);
it('aborts replaced actions and unmount without accepting late results', async () => {
  const old = deferred(),
    next = deferred();
  const a = {
    load: jest.fn<MyCardsActions['load']>().mockReturnValue(old.promise),
  };
  const b = {
    load: jest.fn<MyCardsActions['load']>().mockReturnValue(next.promise),
  };
  const { result, rerender, unmount } = await renderHook(
    ({ actions }: { actions: MyCardsActions }) => useMyCards(actions, 'all'),
    { initialProps: { actions: a } },
  );
  await rerender({ actions: b });
  expect(a.load.mock.calls[0][1].aborted).toBe(true);
  await act(async () =>
    old.resolve({ items: [item('old')], next_cursor: null }),
  );
  expect(result.current.items).toEqual([]);
  await unmount();
  expect(b.load.mock.calls[0][1].aborted).toBe(true);
  await act(async () =>
    next.resolve({ items: [item('late')], next_cursor: null }),
  );
});
it('rejects repeated page cursors while preserving confirmed rows', async () => {
  const actions = {
    load: jest
      .fn<MyCardsActions['load']>()
      .mockResolvedValueOnce({ items: [item('a')], next_cursor: 'same' })
      .mockResolvedValueOnce({ items: [item('b')], next_cursor: 'same' }),
  };
  const { result } = await renderHook(() => useMyCards(actions, 'all'));
  await act(async () => result.current.loadMore());
  expect(result.current.items.map((card) => card.id)).toEqual(['a']);
  expect(result.current.error).toBe('more');
});

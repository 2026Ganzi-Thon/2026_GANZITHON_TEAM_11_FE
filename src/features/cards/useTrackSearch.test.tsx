import { afterEach, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import { createMockSongCards } from '../../mocks/songCards';
import type { Track } from '../../api/contracts';
import { useTrackSearch } from './useTrackSearch';
const tick = () =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(300);
  });
afterEach(() => {
  jest.useRealTimers();
});
it('ignores an old search response or error even when the provider ignores abort', async () => {
  jest.useFakeTimers();
  const actions = createMockSongCards();
  let oldResolve!: (value: Track[]) => void,
    nextResolve!: (value: Track[]) => void;
  const search = jest
    .spyOn(actions, 'search')
    .mockImplementationOnce(
      () =>
        new Promise((yes) => {
          oldResolve = yes;
        }),
    )
    .mockImplementationOnce(
      () =>
        new Promise((yes) => {
          nextResolve = yes;
        }),
    );
  const view = await renderHook<
    ReturnType<typeof useTrackSearch>,
    { query: string }
  >(({ query }) => useTrackSearch(actions, query, true), {
    initialProps: { query: 'old' },
  });
  await tick();
  await view.rerender({ query: 'new' });
  expect(search.mock.calls[0][1].aborted).toBe(true);
  await tick();
  const current: Track = {
    id: 'new',
    title: 'new',
    artist: 'artist',
    cover_url: null,
    spotify_search_url: '',
  };
  await act(async () => nextResolve([current]));
  await act(async () => oldResolve([{ ...current, id: 'old' }]));
  expect(view.result.current.items.map((t) => t.id)).toEqual(['new']);
  await view.unmount();
  expect(search.mock.calls[1][1].aborted).toBe(true);
});
it('ignores a late failure from the previous query after the next query succeeds', async () => {
  jest.useFakeTimers();
  const actions = createMockSongCards();
  let reject!: (e: Error) => void;
  jest.spyOn(actions, 'search').mockImplementationOnce(
    () =>
      new Promise((_yes, no) => {
        reject = no;
      }),
  );
  const view = await renderHook<
    ReturnType<typeof useTrackSearch>,
    { query: string }
  >(({ query }) => useTrackSearch(actions, query, true), {
    initialProps: { query: 'old' },
  });
  await tick();
  await view.rerender({ query: 'new' });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(700);
  });
  await act(async () => reject(new Error('old failure')));
  expect(view.result.current.status).toBe('done');
  expect(view.result.current.items).toHaveLength(3);
});

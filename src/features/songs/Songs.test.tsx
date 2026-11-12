import { BackHandler } from 'react-native';
import { describe, it, expect, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SongSaveButton } from './SongSaveButton';
import { SavedSongsScreen } from './SavedSongsScreen';
import type { SongActions, SongExternalActions, SavedSong } from './types';
const song: SavedSong = {
  card_id: 'c1',
  saved_at: '2026-11-12T16:12:00Z',
  track: {
    id: 't1',
    title: '긴 밤의 노래',
    artist: '가수',
    cover_url: null,
    spotify_search_url: '',
  },
};
const actions = () => ({
  load: jest.fn<SongActions['load']>().mockResolvedValue([song]),
  set: jest.fn<SongActions['set']>().mockResolvedValue(false),
});
const external = () => ({
  open: jest.fn<SongExternalActions['open']>().mockResolvedValue(undefined),
  copy: jest.fn<SongExternalActions['copy']>().mockResolvedValue(undefined),
});
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
describe('saved songs', () => {
  it('confirms only after saving, blocks duplicate presses, and preserves state on failure', async () => {
    const api = actions();
    let resolve!: (value: boolean) => void;
    api.set
      .mockImplementationOnce(
        () =>
          new Promise((r) => {
            resolve = r;
          }),
      )
      .mockRejectedValueOnce(new Error('network'));
    await render(<SongSaveButton cardId="c1" saved={false} actions={api} />);
    await press('노래 담기');
    await press('노래 담기');
    expect(api.set).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('노래를 담았어요.')).toBeNull();
    await act(async () => resolve(true));
    expect(screen.getByRole('button', { name: '노래 담기 취소' })).toBeTruthy();
    await press('노래 담기 취소');
    expect(await screen.findByText(/변경하지 못했어요/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '노래 담기 취소' })).toBeTruthy();
  });
  it('aborts a pending song save and ignores a late result', async () => {
    const api = actions();
    let resolve!: (v: boolean) => void;
    api.set.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const view = await render(
      <SongSaveButton cardId="c1" saved={false} actions={api} />,
    );
    await press('노래 담기');
    await view.unmount();
    expect(api.set.mock.calls[0][2].aborted).toBe(true);
    await act(async () => resolve(true));
  });
  it('distinguishes a failed list from empty and retries', async () => {
    const api = actions();
    api.load.mockRejectedValueOnce(new Error('network')).mockResolvedValue([]);
    await render(
      <SavedSongsScreen
        actions={api}
        external={external()}
        onBack={() => {}}
      />,
    );
    expect(screen.queryByText('담은 노래가 없어요.')).toBeNull();
    await press('다시 불러오기');
    expect(await screen.findByText('담은 노래가 없어요.')).toBeTruthy();
  });
  it('opens and copies the exact track, handles failure, and removes only after confirmation', async () => {
    const api = actions();
    api.set
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue(false);
    const io = external();
    io.open.mockRejectedValueOnce(new Error('unavailable'));
    io.copy.mockRejectedValueOnce(new Error('denied'));
    await render(
      <SavedSongsScreen actions={api} external={io} onBack={() => {}} />,
    );
    await press('Spotify에서 찾기');
    expect(await screen.findByText(/Spotify를 열지 못했어요/)).toBeTruthy();
    await press('곡 정보 복사');
    expect(await screen.findByText(/복사하지 못했어요/)).toBeTruthy();
    await press('곡 정보 복사');
    expect(await screen.findByText('곡 정보를 복사했어요.')).toBeTruthy();
    expect(io.copy).toHaveBeenLastCalledWith(song.track);
    await press('담기 취소');
    expect(await screen.findByText(/담기를 취소하지 못했어요/)).toBeTruthy();
    expect(screen.getByText('긴 밤의 노래')).toBeTruthy();
    await press('담기 취소');
    expect(await screen.findByText('담은 노래가 없어요.')).toBeTruthy();
    expect(api.set).toHaveBeenLastCalledWith(
      'c1',
      false,
      expect.any(AbortSignal),
    );
  });
  it('ignores old list responses when the night adapter changes', async () => {
    const first = actions();
    let resolve!: (v: SavedSong[]) => void;
    first.load.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const second = actions();
    second.load.mockResolvedValue([]);
    const view = await render(
      <SavedSongsScreen
        actions={first}
        external={external()}
        onBack={() => {}}
      />,
    );
    await view.rerender(
      <SavedSongsScreen
        actions={second}
        external={external()}
        onBack={() => {}}
      />,
    );
    expect(first.load.mock.calls[0][0].aborted).toBe(true);
    await act(async () => resolve([song]));
    expect(screen.getByText('담은 노래가 없어요.')).toBeTruthy();
    expect(screen.queryByText('긴 밤의 노래')).toBeNull();
  });
  it('resets a reused card when its night adapter changes, even if the old request never resolves', async () => {
    const first = actions();
    first.set.mockImplementation(() => new Promise(() => {}));
    const second = actions();
    second.set.mockResolvedValue(true);
    const view = await render(
      <SongSaveButton cardId="c1" saved={true} actions={first} />,
    );
    await press('노래 담기 취소');
    await view.rerender(
      <SongSaveButton cardId="c1" saved={false} actions={second} />,
    );
    expect(first.set.mock.calls[0][2].aborted).toBe(true);
    expect(
      screen.getByRole('button', { name: '노래 담기' }),
    ).not.toBeDisabled();
    await press('노래 담기');
    expect(await screen.findByText('노래를 담았어요.')).toBeTruthy();
  });
  it('blocks duplicate removals and aborts a removal when the list is closed', async () => {
    const api = actions();
    let resolve!: (v: boolean) => void;
    api.set.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const view = await render(
      <SavedSongsScreen
        actions={api}
        external={external()}
        onBack={() => {}}
      />,
    );
    await press('담기 취소');
    await press('담기 취소');
    expect(api.set).toHaveBeenCalledTimes(1);
    expect(screen.getByText('긴 밤의 노래')).toBeTruthy();
    await view.unmount();
    expect(api.set.mock.calls[0][2].aborted).toBe(true);
    await act(async () => resolve(false));
  });
  it('uses system back to close the list and cancel loading', async () => {
    let back: Parameters<typeof BackHandler.addEventListener>[1] | undefined;
    const spy = jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((_event, callback) => {
        back = callback;
        return { remove: () => {} };
      });
    try {
      const api = actions();
      api.load.mockImplementation(() => new Promise(() => {}));
      const exit = jest.fn();
      await render(
        <SavedSongsScreen actions={api} external={external()} onBack={exit} />,
      );
      await act(async () => {
        back?.({} as Parameters<NonNullable<typeof back>>[0]);
      });
      expect(exit).toHaveBeenCalledTimes(1);
      expect(api.load.mock.calls[0][0].aborted).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });
});

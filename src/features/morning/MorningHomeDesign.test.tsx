import { afterEach, expect, it, jest } from '@jest/globals';
import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';
import { MorningScreen } from './MorningScreen';
import { createMockMorning } from '../../mocks/morning';
import { createMockSettings } from '../../mocks/settings';
import type { SavedSong, SongActions } from '../songs/types';
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
async function tick() {
  await act(async () => {
    await jest.runAllTimersAsync();
  });
  await act(async () => {
    await jest.runAllTimersAsync();
  });
}
afterEach(() => {
  jest.useRealTimers();
});
const song: SavedSong = {
  card_id: 'saved-song',
  saved_at: '2026-11-10T18:00:00Z',
  track: {
    id: 'track',
    title: '긴 밤의 끝에서',
    artist: '가수',
    cover_url: null,
    spotify_search_url: '',
  },
};
it('shows account totals rather than last-night counts and keeps the settings icon connected', async () => {
  jest.useFakeTimers();
  const actions = {
    ...createMockMorning('existing'),
    settings: createMockSettings(),
  };
  await render(
    <MorningScreen
      actions={actions}
      fortuneKey="2026-12-01"
      onExit={() => {}}
    />,
  );
  await tick();
  expect(screen.getByRole('header', { name: '나의 양떼 · 66밤' })).toBeTruthy();
  expect(screen.getByText('2026.12')).toBeTruthy();
  expect(screen.queryByText('어젯밤')).toBeNull();
  expect(screen.getByText('양을 세고 잠든 밤 · 총 658마리')).toBeTruthy();
  await press('설정 열기');
  await tick();
  expect(screen.getByLabelText('로그인 정보: yang@example.com')).toBeTruthy();
  await press('아침 홈으로 돌아가기');
  await tick();
  expect(screen.getByRole('header', { name: '나의 양떼 · 66밤' })).toBeTruthy();
});
it('keeps every real sheep reachable and marks the adopted night without relying on array order', async () => {
  jest.useFakeTimers();
  const actions = createMockMorning('existing');
  const pending = actions.loadFlock(new AbortController().signal);
  await tick();
  const real = await pending;
  const many = Array.from({ length: 18 }, (_, index) => ({
    ...real[0],
    id: `sheep-${index}`,
    night_id: `night-${index}`,
    night_date: `2026-10-${String(index + 1).padStart(2, '0')}`,
  }));
  const loadDetail = jest.fn(actions.loadSheep);
  const source = { ...actions, loadFlock: async () => [...many, ...real] };
  await render(
    <MorningScreen
      actions={source}
      loadDetail={loadDetail}
      onExit={() => {}}
    />,
  );
  await tick();
  expect(screen.getAllByRole('button', { name: /의 양/ })).toHaveLength(
    many.length + real.length,
  );
  expect(
    within(screen.getByRole('button', { name: '2026-11-10의 양' })).getByText(
      '어젯밤',
    ),
  ).toBeTruthy();
  expect(
    within(screen.getByRole('button', { name: '2026-10-01의 양' })).queryByText(
      '어젯밤',
    ),
  ).toBeNull();
  await press('2026-11-10의 양');
  await tick();
  expect(loadDetail).toHaveBeenCalledWith(
    'preview-adopted',
    expect.any(AbortSignal),
  );
});
it('opens the existing saved-song list and refreshes its preview after removing the last song', async () => {
  jest.useFakeTimers();
  let saved = true;
  const songs: SongActions = {
    load: async () => (saved ? [song] : []),
    set: async (_id, value) => {
      saved = value;
      return value;
    },
  };
  const actions = { ...createMockMorning('existing'), songs };
  await render(<MorningScreen actions={actions} onExit={() => {}} />);
  await tick();
  expect(screen.getByText('긴 밤의 끝에서 · 가수')).toBeTruthy();
  await press('어젯밤 담은 노래 열기');
  await tick();
  expect(screen.getByRole('button', { name: 'Spotify에서 찾기' })).toBeTruthy();
  await press('담기 취소');
  await tick();
  await press('양떼로 돌아가기');
  await tick();
  expect(
    screen.queryByRole('button', { name: '어젯밤 담은 노래 열기' }),
  ).toBeNull();
  expect(screen.getByRole('button', { name: '담은 노래 보기' })).toBeTruthy();
});
it('shows a retry instead of fabricated zero totals when profile lookup fails', async () => {
  jest.useFakeTimers();
  const settings = createMockSettings();
  const original = settings.loadMe;
  settings.loadMe = jest
    .fn(original)
    .mockRejectedValueOnce(new Error('offline'));
  const actions = { ...createMockMorning('existing'), settings };
  await render(<MorningScreen actions={actions} onExit={() => {}} />);
  await tick();
  expect(screen.queryByText('양을 세고 잠든 밤 · 총 0마리')).toBeNull();
  await press('홈 기록 다시 불러오기');
  await tick();
  expect(screen.getByText('양을 세고 잠든 밤 · 총 658마리')).toBeTruthy();
});

it('cancels an old song preview load and ignores its late result after the home source changes', async () => {
  jest.useFakeTimers();
  let resolve!: (items: SavedSong[]) => void;
  let signal!: AbortSignal;
  const pending = new Promise<SavedSong[]>((done) => {
    resolve = done;
  });
  const base = createMockMorning('existing');
  const old = {
    ...base,
    songs: {
      load: async (value: AbortSignal) => {
        signal = value;
        return pending;
      },
      set: async () => false,
    },
  };
  const view = await render(<MorningScreen actions={old} onExit={() => {}} />);
  await tick();
  await view.rerender(
    <MorningScreen
      actions={{
        ...base,
        songs: { load: async () => [], set: async () => false },
      }}
      onExit={() => {}}
    />,
  );
  await tick();
  expect(signal.aborted).toBe(true);
  await act(async () => {
    resolve([song]);
  });
  expect(
    screen.queryByRole('button', { name: '어젯밤 담은 노래 열기' }),
  ).toBeNull();
});

it('keeps a visible recovery entry when the song summary cannot be loaded', async () => {
  jest.useFakeTimers();
  const songs: SongActions = {
    load: jest
      .fn<SongActions['load']>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue([song]),
    set: async () => false,
  };
  await render(
    <MorningScreen
      actions={{ ...createMockMorning('existing'), songs }}
      onExit={() => {}}
    />,
  );
  await tick();
  await press('담은 노래 확인하기');
  await tick();
  expect(screen.getByRole('header', { name: '긴 밤의 끝에서' })).toBeTruthy();
});

import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ApiError } from '../../api/errors';
import { BackHandler } from 'react-native';
import { MorningScreen } from './MorningScreen';
import type { Morning, MorningActions, MorningCandidate, Sheep } from './types';

const candidate = (id: string, position: number | null): MorningCandidate => ({
  card: {
    id,
    kind: 'text',
    available: true,
    content: { text: `본문 ${id}` },
    tone: 'warm',
    category_id: 'career',
    author_type: 'seed',
    author_label: null,
    viewer: { yarn_sent: false, fluff_saved: false, song_saved: false },
  },
  can_adopt: true,
  fluff_saved: false,
  position,
  sheep_count: 6,
  last_viewed_at: '2026-11-10T18:00:00Z',
});
const sheep: Sheep = {
  id: 'sheep-1',
  card_id: 'b',
  night_id: 'n1',
  night_date: '2026-11-10',
  color_key: 'career',
};
const morning: Morning = {
  night: { id: 'n1', night_date: '2026-11-10' },
  counted_sheep: 14,
  candidate_cards: [candidate('b', null), candidate('a', 1)],
  default_card_id: 'b',
  adoption: null,
};
function actions(): MorningActions {
  return {
    loadMorning: jest
      .fn<MorningActions['loadMorning']>()
      .mockResolvedValue(morning),
    adopt: jest.fn<MorningActions['adopt']>().mockResolvedValue(sheep),
    loadFlock: jest
      .fn<MorningActions['loadFlock']>()
      .mockResolvedValue([sheep]),
  };
}
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
const choose = (name: string) =>
  fireEvent.press(screen.getByRole('radio', { name }));
afterEach(() => {
  jest.restoreAllMocks();
});
describe('morning adoption', () => {
  it('uses the returned count, order and default without saving automatically', async () => {
    const api = actions();
    await render(<MorningScreen actions={api} onExit={() => {}} />);
    expect(screen.getByText('어젯밤 양 14마리가\n넘어갔어요')).toBeTruthy();
    expect(
      screen.getAllByRole('radio').map((n) => n.props.accessibilityLabel),
    ).toEqual(['마무리 카드', '1번째 양']);
    expect(screen.getByRole('radio', { name: '마무리 카드' })).toBeChecked();
    expect(screen.getByText('본문 b')).toBeTruthy();
    expect(api.adopt).not.toHaveBeenCalled();
  });
  it('requires explicit selection if the default is not eligible and conceals unavailable content', async () => {
    const api = actions();
    const unavailable = candidate('secret', 2);
    unavailable.card.available = false;
    const blocked = { ...candidate('blocked', 3), can_adopt: false };
    api.loadMorning = async () => ({
      ...morning,
      default_card_id: 'secret',
      candidate_cards: [unavailable, blocked, candidate('a', 1)],
    });
    await render(<MorningScreen actions={api} onExit={() => {}} />);
    expect(screen.queryByText('본문 secret')).toBeNull();
    expect(
      screen.getByRole('radio', { name: '2번째 양 · 볼 수 없는 카드' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('radio', { name: '3번째 양 · 데려올 수 없는 양' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: '이 양 데려오기' }),
    ).toBeDisabled();
    await choose('1번째 양');
    expect(screen.getByText('본문 a')).toBeTruthy();
  });
  it('shows song metadata but hides generated recommendation and attribution even if supplied', async () => {
    const api = actions();
    const song: MorningCandidate = {
      ...candidate('song', 4),
      card: {
        ...candidate('song', 4).card,
        kind: 'song',
        author_type: 'ai',
        author_label: 'hidden author',
        content: {
          track: {
            id: 't',
            title: '곡',
            artist: '가수',
            cover_url: null,
            spotify_search_url: '',
          },
          recommendation: 'hidden recommendation',
        },
      },
    };
    api.loadMorning = async () => ({
      ...morning,
      candidate_cards: [song],
      default_card_id: 'song',
    });
    await render(<MorningScreen actions={api} onExit={() => {}} />);
    expect(screen.getByText('곡 · 가수')).toBeTruthy();
    expect(screen.queryByText('hidden author')).toBeNull();
    expect(screen.queryByText('hidden recommendation')).toBeNull();
  });
  it('locks requests and selection until success, then displays the returned sheep only once', async () => {
    const api = actions();
    let resolve!: (s: Sheep) => void;
    const adopt = jest.fn<MorningActions['adopt']>().mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    api.adopt = adopt;
    await render(<MorningScreen actions={api} onExit={() => {}} />);
    await press('이 양 데려오기');
    await press('이 양 데려오기');
    expect(adopt).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('radio', { name: '1번째 양' })).toBeDisabled();
    expect(screen.queryByText('나의 양떼')).toBeNull();
    await act(async () => resolve(sheep));
    expect(screen.getByText('나의 양떼')).toBeTruthy();
    expect(
      screen.getAllByLabelText('2026-11-10의 양 · 새로 온 양'),
    ).toHaveLength(1);
    expect(adopt).toHaveBeenCalledWith('n1', 'b', expect.any(AbortSignal));
  });
  it('retains the chosen card after failure and retries its exact selection', async () => {
    const api = actions();
    const adopt = jest
      .fn<MorningActions['adopt']>()
      .mockRejectedValueOnce(new Error('private detail'))
      .mockResolvedValue({ ...sheep, card_id: 'a' });
    api.adopt = adopt;
    await render(<MorningScreen actions={api} onExit={() => {}} />);
    await choose('1번째 양');
    await press('이 양 데려오기');
    expect(screen.queryByText('private detail')).toBeNull();
    expect(screen.getByRole('radio', { name: '1번째 양' })).toBeChecked();
    expect(screen.getByText('본문 a')).toBeTruthy();
    await press('이 양 데려오기');
    expect(adopt.mock.calls.map((call) => call.slice(0, 2))).toEqual([
      ['n1', 'a'],
      ['n1', 'a'],
    ]);
  });
  it('reconciles a finalized adoption instead of submitting another card', async () => {
    const api = actions();
    api.loadMorning = jest
      .fn<MorningActions['loadMorning']>()
      .mockResolvedValueOnce(morning)
      .mockResolvedValue({ ...morning, adoption: sheep });
    api.adopt = jest.fn<MorningActions['adopt']>().mockRejectedValue(
      new ApiError('http', {
        status: 409,
        code: 'ADOPTION_ALREADY_FINALIZED',
      }),
    );
    await render(<MorningScreen actions={api} onExit={() => {}} />);
    await press('이 양 데려오기');
    expect(screen.getByText('나의 양떼')).toBeTruthy();
    expect(api.adopt).toHaveBeenCalledTimes(1);
  });
  it('blocks saving when reconciliation fails and retries the read only', async () => {
    const api = actions();
    api.loadMorning = jest
      .fn<MorningActions['loadMorning']>()
      .mockResolvedValueOnce(morning)
      .mockRejectedValueOnce(new Error())
      .mockResolvedValue({ ...morning, adoption: sheep });
    api.adopt = jest.fn<MorningActions['adopt']>().mockRejectedValue(
      new ApiError('http', {
        status: 409,
        code: 'ADOPTION_ALREADY_FINALIZED',
      }),
    );
    await render(<MorningScreen actions={api} onExit={() => {}} />);
    await press('이 양 데려오기');
    expect(screen.queryByRole('button', { name: '이 양 데려오기' })).toBeNull();
    await press('다시 불러오기');
    expect(screen.getByText('나의 양떼')).toBeTruthy();
    expect(api.adopt).toHaveBeenCalledTimes(1);
  });
  it('invalidates a candidate deleted between selection and saving', async () => {
    const api = actions();
    api.loadMorning = jest
      .fn<MorningActions['loadMorning']>()
      .mockResolvedValueOnce(morning)
      .mockResolvedValue({
        ...morning,
        candidate_cards: [{ ...candidate('b', null), can_adopt: false }],
      });
    api.adopt = jest
      .fn<MorningActions['adopt']>()
      .mockRejectedValue(
        new ApiError('http', { status: 409, code: 'CARD_UNAVAILABLE' }),
      );
    await render(<MorningScreen actions={api} onExit={() => {}} />);
    await press('이 양 데려오기');
    expect(screen.getByText('데려올 수 있는 양이 없어요')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '이 양 데려오기' })).toBeNull();
  });
  it('keeps a successful adoption visible if the flock read fails and retries only that read', async () => {
    const api = actions();
    api.loadFlock = jest
      .fn<MorningActions['loadFlock']>()
      .mockRejectedValueOnce(new Error())
      .mockResolvedValue([sheep]);
    await render(<MorningScreen actions={api} onExit={() => {}} />);
    await press('이 양 데려오기');
    expect(screen.getByLabelText('2026-11-10의 양 · 새로 온 양')).toBeTruthy();
    await press('양떼 다시 불러오기');
    expect(
      screen.getAllByLabelText('2026-11-10의 양 · 새로 온 양'),
    ).toHaveLength(1);
    expect(api.adopt).toHaveBeenCalledTimes(1);
  });
  it('opens an existing adoption without saving or highlighting it as new', async () => {
    const api = actions();
    api.loadMorning = async () => ({ ...morning, adoption: sheep });
    await render(<MorningScreen actions={api} onExit={() => {}} />);
    expect(screen.getByLabelText('2026-11-10의 양')).toBeTruthy();
    expect(screen.queryByText('새로 온 양')).toBeNull();
    expect(api.adopt).not.toHaveBeenCalled();
  });
  it('shows no-record and empty flock states without creating an adoption', async () => {
    const api = actions();
    api.loadMorning = async () => ({
      ...morning,
      night: null,
      candidate_cards: [],
      default_card_id: null,
      counted_sheep: null,
    });
    api.loadFlock = async () => [];
    await render(<MorningScreen actions={api} onExit={() => {}} />);
    expect(screen.getByText('아직 어젯밤 기록이 없어요')).toBeTruthy();
    await press('양떼 보기');
    expect(screen.getByText('아직 양떼가 비어 있어요')).toBeTruthy();
    expect(api.adopt).not.toHaveBeenCalled();
  });
  it('retries initial loading without exposing error details', async () => {
    const api = actions();
    api.loadMorning = jest
      .fn<MorningActions['loadMorning']>()
      .mockRejectedValueOnce(new Error('private'))
      .mockResolvedValue(morning);
    await render(<MorningScreen actions={api} onExit={() => {}} />);
    expect(screen.queryByText('private')).toBeNull();
    await press('다시 불러오기');
    expect(screen.getByText('본문 b')).toBeTruthy();
  });
  it('cancels the initial read on unmount without following a late adoption into a flock read', async () => {
    const api = actions();
    let resolve!: (value: Morning) => void;
    const load = jest.fn<MorningActions['loadMorning']>().mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    api.loadMorning = load;
    await render(<MorningScreen actions={api} onExit={() => {}} />);
    await screen.unmount();
    expect(load.mock.calls[0][0].aborted).toBe(true);
    await act(async () => resolve({ ...morning, adoption: sheep }));
    expect(api.loadFlock).not.toHaveBeenCalled();
  });
  it('cancels a pending flock read on hardware back and removes the listener', async () => {
    let back: Parameters<typeof BackHandler.addEventListener>[1] | undefined;
    const remove = jest.fn();
    jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((_name, callback) => {
        back = callback;
        return { remove };
      });
    const api = actions();
    api.loadMorning = async () => ({ ...morning, adoption: sheep });
    let resolve!: (value: Sheep[]) => void;
    const load = jest.fn<MorningActions['loadFlock']>().mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    api.loadFlock = load;
    const exit = jest.fn();
    await render(<MorningScreen actions={api} onExit={exit} />);
    await act(async () => {
      back?.({ type: 'hardwareBackPress', timeStamp: 0 });
    });
    expect(load.mock.calls[0][0].aborted).toBe(true);
    expect(exit).toHaveBeenCalledTimes(1);
    await act(async () =>
      resolve([{ ...sheep, id: 'late', night_date: '2099-01-01' }]),
    );
    expect(screen.queryByLabelText('2099-01-01의 양')).toBeNull();
    await screen.unmount();
    expect(remove).toHaveBeenCalled();
  });
  it('aborts on exit and ignores a late successful adoption', async () => {
    const api = actions();
    let resolve!: (s: Sheep) => void;
    const adopt = jest.fn<MorningActions['adopt']>().mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    api.adopt = adopt;
    const exit = jest.fn();
    await render(<MorningScreen actions={api} onExit={exit} />);
    await press('이 양 데려오기');
    await press('미리보기 나가기');
    expect(adopt.mock.calls[0][2].aborted).toBe(true);
    await act(async () => resolve(sheep));
    expect(screen.queryByText('나의 양떼')).toBeNull();
    expect(api.loadFlock).not.toHaveBeenCalled();
    expect(exit).toHaveBeenCalledTimes(1);
  });
});

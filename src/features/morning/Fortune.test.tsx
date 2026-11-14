import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { MorningScreen } from './MorningScreen';
import { createMockMorning } from '../../mocks/morning';
import { createMockFortune, type FortuneScenario } from '../../mocks/fortune';
import type { Fortune, FortuneActions } from '../fortune/types';
import { ApiError } from '../../api/errors';
import { AppState } from 'react-native';
import { createMockReceivedYarn } from '../../mocks/receivedYarn';

const example = {
  date: '2026-11-14',
  zodiac: 'taurus',
  rank: 3,
  sheep_type: 'sparkling',
  message: '하고 싶던 일을 시작하기 좋은 날이야',
  lucky_color: '연두',
  lucky_item: '손수건',
  small_action: '미뤄 둔 연락 하나 해 볼까?',
} as const;
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
  jest.restoreAllMocks();
  if (originalAppState)
    Object.defineProperty(AppState, 'currentState', originalAppState);
  jest.useRealTimers();
});
const originalAppState = Object.getOwnPropertyDescriptor(
  AppState,
  'currentState',
);
async function home(scenario: FortuneScenario = 'success') {
  jest.useFakeTimers();
  const fortune = createMockFortune(scenario),
    load = jest.spyOn(fortune, 'load');
  const base = createMockMorning('existing'),
    flock = jest.spyOn(base, 'loadFlock');
  const actions = { ...base, fortune };
  const view = await render(
    <MorningScreen actions={actions} onExit={() => {}} />,
  );
  await tick();
  return { view, fortune, load, flock, actions };
}

it('loads fortune only in home, opens it on the fortune sheep and retains the daily result on reopen', async () => {
  jest.useFakeTimers();
  const fortune = {
    load: jest
      .fn<(_signal: AbortSignal) => Promise<typeof example>>()
      .mockResolvedValue(example),
  };
  const actions = { ...createMockMorning(), fortune };
  await render(<MorningScreen actions={actions} onExit={() => {}} />);
  await tick();
  expect(fortune.load).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: '오늘의 운세 보기' })).toBeNull();
  await press('이 양 데려오기');
  await tick();
  expect(fortune.load).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId('fortune-modal')).toBeNull();
  await press('오늘의 운세 보기');
  expect(screen.getByText('3위')).toBeTruthy();
  expect(screen.getByText('오늘의 3등 양! ✦ · 황소자리')).toBeTruthy();
  expect(screen.getByText('2026.11.14 기준')).toBeTruthy();
  expect(screen.getByText('하고 싶던 일을 시작하기 좋은 날이야')).toBeTruthy();
  expect(screen.getByText('행운 색 연두 · 행운 아이템 손수건')).toBeTruthy();
  expect(
    screen.getByText('작은 행동 · 미뤄 둔 연락 하나 해 볼까?'),
  ).toBeTruthy();
  await press('오늘의 운세 닫기');
  expect(screen.queryByTestId('fortune-modal')).toBeNull();
  expect(screen.getByText('나의 양떼')).toBeTruthy();
  await press('오늘의 운세 보기');
  expect(screen.getByText('3위')).toBeTruthy();
  expect(fortune.load).toHaveBeenCalledTimes(1);
  await fireEvent(screen.getByTestId('fortune-modal'), 'requestClose');
  expect(screen.queryByTestId('fortune-modal')).toBeNull();
});

it.each([
  [1, 'sparkling', '1위'],
  [2, 'sparkling', '2위'],
  [3, 'sparkling', '3위'],
  [null, 'sparkling', '반짝이는 양'],
  [null, 'favorable', '순풍의 양'],
  [null, 'relaxed', '느긋한 양'],
  [null, 'resting', '쉬어 가는 양'],
  [4, 'favorable', '순풍의 양'],
  [12, 'resting', '쉬어 가는 양'],
] as const)(
  'shows rank %s / %s as %s without revealing lower ranks',
  async (rank, sheep_type, title) => {
    jest.useFakeTimers();
    const fortune: FortuneActions = {
      load: async () => ({ ...example, rank, sheep_type }),
    };
    await render(
      <MorningScreen
        actions={{ ...createMockMorning('existing'), fortune }}
        onExit={() => {}}
      />,
    );
    await tick();
    await press('오늘의 운세 보기');
    expect(screen.getByText(title)).toBeTruthy();
    if (rank === null || rank > 3) {
      expect(screen.queryByText(/(?:[1-9]|1[0-2])(?:위|등)/)).toBeNull();
      expect(screen.getByText('황소자리')).toBeTruthy();
    }
  },
);

it('retries only fortune and leaves home and reflection usable after a load failure', async () => {
  const { load, flock } = await home('retry');
  expect(screen.getByText('오늘의 운세를 불러오지 못했어요')).toBeTruthy();
  expect(screen.getByText('나의 양떼')).toBeTruthy();
  await press('어젯밤 돌아보기');
  await tick();
  expect(screen.getByTestId('reflection-modal')).toBeTruthy();
  expect(
    screen.getByRole('button', { name: '오늘의 운세 보기' }),
  ).toBeDisabled();
  await press('오늘의 운세 보기');
  expect(screen.queryByTestId('fortune-modal')).toBeNull();
  await fireEvent(screen.getByTestId('reflection-modal'), 'requestClose');
  await press('운세 다시 불러오기');
  await tick();
  expect(load).toHaveBeenCalledTimes(2);
  expect(flock).toHaveBeenCalledTimes(1);
  await press('오늘의 운세 보기');
  expect(screen.getByText('3위')).toBeTruthy();
});

it('keeps an unavailable daily fortune unavailable on retries, with no invented result', async () => {
  const { load } = await home('unavailable');
  await press('오늘의 운세 보기');
  expect(screen.getByText('오늘의 운세가 아직 준비되지 않았어요')).toBeTruthy();
  await press('운세 다시 불러오기');
  await tick();
  expect(load).toHaveBeenCalledTimes(2);
  expect(screen.getByText('오늘의 운세가 아직 준비되지 않았어요')).toBeTruthy();
  expect(screen.queryByText('3위')).toBeNull();
  await fireEvent(screen.getByTestId('fortune-modal'), 'requestClose');
  expect(screen.getByText('나의 양떼')).toBeTruthy();
});

it('keeps fortune available while the flock read fails and retries only the flock', async () => {
  jest.useFakeTimers();
  const base = createMockMorning('existing');
  jest
    .spyOn(base, 'loadFlock')
    .mockRejectedValueOnce(new ApiError('network'))
    .mockResolvedValue([]);
  const fortune = createMockFortune(),
    load = jest.spyOn(fortune, 'load');
  await render(
    <MorningScreen actions={{ ...base, fortune }} onExit={() => {}} />,
  );
  await tick();
  await press('오늘의 운세 보기');
  expect(screen.getByText('3위')).toBeTruthy();
  await press('오늘의 운세 닫기');
  expect(screen.getByText(/양떼를 모두 불러오지 못했어요/)).toBeTruthy();
  await press('양떼 다시 불러오기');
  await tick();
  expect(load).toHaveBeenCalledTimes(1);
});

it('shows the daily fortune even when no sheep have been adopted yet', async () => {
  jest.useFakeTimers();
  const fortune = createMockFortune();
  await render(
    <MorningScreen
      actions={{ ...createMockMorning('empty'), fortune }}
      onExit={() => {}}
    />,
  );
  await tick();
  await press('양떼 보기');
  await tick();
  expect(screen.getByText('아직 양떼가 비어 있어요')).toBeTruthy();
  await press('오늘의 운세 보기');
  expect(screen.getByText('3위')).toBeTruthy();
});

it.each([
  ['date', '2026-02-30'],
  ['zodiac', 'unknown'],
  ['rank', 0],
  ['rank', 13],
  ['rank', 1.5],
  ['sheep_type', 'bad'],
  ['message', '  '],
  ['lucky_color', ''],
  ['lucky_item', null],
  ['small_action', ''],
] as const)(
  'rejects malformed %s=%s without showing a partial fortune',
  async (field, value) => {
    jest.useFakeTimers();
    const fortune: FortuneActions = {
      load: async () => ({ ...example, [field]: value }) as unknown as Fortune,
    };
    await render(
      <MorningScreen
        actions={{ ...createMockMorning('existing'), fortune }}
        onExit={() => {}}
      />,
    );
    await tick();
    await press('오늘의 운세 보기');
    expect(screen.getByText('오늘의 운세를 불러오지 못했어요')).toBeTruthy();
    expect(screen.queryByText('3위')).toBeNull();
    expect(screen.queryByText(example.message)).toBeNull();
  },
);

it('keeps long daily text intact across close/reopen and same-source morning reentry', async () => {
  const { view, actions, load } = await home('long');
  await press('오늘의 운세 보기');
  const message = '하고 싶던 일을 시작하기 좋은 날이야. '.repeat(12);
  expect(screen.getByText(message)).toBeTruthy();
  await press('오늘의 운세 닫기');
  await press('오늘의 운세 보기');
  expect(screen.getByText(message)).toBeTruthy();
  await view.unmount();
  await render(<MorningScreen actions={actions} onExit={() => {}} />);
  await tick();
  expect(screen.queryByTestId('fortune-modal')).toBeNull();
  await press('오늘의 운세 보기');
  expect(screen.getByText(message)).toBeTruthy();
  expect(load).toHaveBeenCalledTimes(2);
});

it.each(['success', 'failure'] as const)(
  'aborts an old source and ignores its late %s while showing the new daily result',
  async (outcome) => {
    jest.useFakeTimers();
    let finish!: () => void, oldSignal!: AbortSignal;
    const fortune: FortuneActions = {
      load: (signal) => {
        oldSignal = signal;
        return new Promise((resolve, reject) => {
          finish = () =>
            outcome === 'success'
              ? resolve(example)
              : reject(new ApiError('network'));
        });
      },
    };
    const view = await render(
      <MorningScreen
        actions={{ ...createMockMorning('existing'), fortune }}
        onExit={() => {}}
      />,
    );
    await tick();
    await press('오늘의 운세 보기');
    expect(screen.getByLabelText('운세 불러오는 중')).toBeTruthy();
    const next = {
      ...createMockMorning('existing'),
      fortune: createMockFortune('next-day'),
    };
    await view.rerender(<MorningScreen actions={next} onExit={() => {}} />);
    await tick();
    expect(oldSignal.aborted).toBe(true);
    expect(screen.queryByTestId('fortune-modal')).toBeNull();
    await act(async () => finish());
    await press('오늘의 운세 보기');
    expect(screen.getByText('2026.11.15 기준')).toBeTruthy();
    expect(screen.getByText('오늘의 3등 양! ✦ · 쌍둥이자리')).toBeTruthy();
    expect(screen.queryByText('오늘의 운세를 불러오지 못했어요')).toBeNull();
  },
);

it('keeps a delayed read alive when the popup closes, but cancels it on leaving home', async () => {
  jest.useFakeTimers();
  const fortune = createMockFortune('slow'),
    load = jest.spyOn(fortune, 'load');
  const view = await render(
    <MorningScreen
      actions={{ ...createMockMorning('existing'), fortune }}
      onExit={() => {}}
    />,
  );
  await act(async () => {
    await jest.advanceTimersByTimeAsync(600);
  });
  await press('오늘의 운세 보기');
  await press('오늘의 운세 닫기');
  expect(load.mock.calls[0][0].aborted).toBe(false);
  await view.unmount();
  expect(load.mock.calls[0][0].aborted).toBe(true);
});

it('clears the daily source timer and abort listener when its request is cancelled', async () => {
  jest.useFakeTimers();
  const controller = new AbortController(),
    remove = jest.spyOn(controller.signal, 'removeEventListener');
  const pending = createMockFortune('slow').load(controller.signal);
  const rejected = expect(pending).rejects.toMatchObject({ kind: 'aborted' });
  controller.abort();
  await rejected;
  expect(jest.getTimerCount()).toBe(0);
  expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
});

it('waits to present received yarn until fortune closes, then confirms its native display', async () => {
  jest.useFakeTimers();
  Object.defineProperty(AppState, 'currentState', {
    value: 'active',
    configurable: true,
    writable: true,
  });
  jest
    .spyOn(AppState, 'addEventListener')
    .mockReturnValue({ remove: () => {} });
  const receivedYarn = createMockReceivedYarn('slow-load'),
    seen = jest.spyOn(receivedYarn, 'markSeen');
  const fortune = createMockFortune(),
    load = jest.spyOn(fortune, 'load');
  await render(
    <MorningScreen
      actions={{ ...createMockMorning('existing'), fortune, receivedYarn }}
      onExit={() => {}}
    />,
  );
  await act(async () => {
    await jest.advanceTimersByTimeAsync(600);
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(600);
  });
  await press('오늘의 운세 보기');
  await tick();
  expect(screen.getByTestId('fortune-modal')).toBeTruthy();
  expect(screen.queryByTestId('received-yarn-modal')).toBeNull();
  expect(seen).not.toHaveBeenCalled();
  await press('오늘의 운세 닫기');
  expect(screen.getByTestId('received-yarn-modal')).toBeTruthy();
  expect(seen).not.toHaveBeenCalled();
  await fireEvent(screen.getByTestId('received-yarn-modal'), 'show');
  await tick();
  expect(seen).toHaveBeenCalledTimes(1);
  await press('받은 털실 닫기');
  await press('오늘의 운세 보기');
  expect(screen.getByText('3위')).toBeTruthy();
  expect(load).toHaveBeenCalledTimes(1);
});

import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { MorningScreen } from './MorningScreen';
import { createMockMorning } from '../../mocks/morning';
import { ApiError } from '../../api/errors';
import {
  createMockReceivedYarn,
  type ReceivedYarnScenario,
} from '../../mocks/receivedYarn';
import type { ReceivedYarnActions } from '../yarnSummary/types';
import type { MorningActions } from './types';
import { createMockCardWriting } from '../../mocks/cardWriting';
import { createMockTextCards } from '../../mocks/textCards';
import { createMockSongCards } from '../../mocks/songCards';
import { AppState, type AppStateStatus } from 'react-native';

async function tick() {
  // Home mounts its independent summary read after the adoption update commits.
  await act(async () => {
    await jest.runAllTimersAsync();
  });
  await act(async () => {
    await jest.runAllTimersAsync();
  });
}
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
const summary = {
  id: 'summary-1',
  date: '2026-11-13',
  yarn_count: 3,
  sender_count: 2,
};
const originalAppState = Object.getOwnPropertyDescriptor(
  AppState,
  'currentState',
);
beforeEach(() => {
  Object.defineProperty(AppState, 'currentState', {
    value: 'active',
    configurable: true,
    writable: true,
  });
  jest
    .spyOn(AppState, 'addEventListener')
    .mockReturnValue({ remove: () => {} });
});
afterEach(() => {
  jest.restoreAllMocks();
  if (originalAppState)
    Object.defineProperty(AppState, 'currentState', originalAppState);
  jest.useRealTimers();
});
const shown = async () => {
  await fireEvent(screen.getByTestId('received-yarn-modal'), 'show');
};
async function open(scenario: ReceivedYarnScenario = 'success') {
  jest.useFakeTimers();
  const received = createMockReceivedYarn(scenario);
  const load = jest.spyOn(received, 'load'),
    seen = jest.spyOn(received, 'markSeen');
  const actions = { ...createMockMorning(), receivedYarn: received };
  const view = await render(
    <MorningScreen actions={actions} onExit={() => {}} />,
  );
  await tick();
  await press('이 양 데려오기');
  await tick();
  return { actions, received, load, seen, view };
}

it('waits for adoption and actual popup presentation before marking the returned summary seen', async () => {
  jest.useFakeTimers();
  const receivedYarn = {
    load: jest
      .fn<(signal: AbortSignal) => Promise<typeof summary | null>>()
      .mockResolvedValue(summary),
    markSeen: jest
      .fn<(id: string, signal: AbortSignal) => Promise<void>>()
      .mockResolvedValue(undefined),
  };
  const actions = { ...createMockMorning(), receivedYarn };
  await render(<MorningScreen actions={actions} onExit={() => {}} />);
  await tick();
  expect(receivedYarn.load).not.toHaveBeenCalled();
  expect(screen.queryByTestId('received-yarn-modal')).toBeNull();
  await press('이 양 데려오기');
  await tick();
  expect(screen.getByText('털실 3개가 도착했어요')).toBeTruthy();
  expect(receivedYarn.markSeen).not.toHaveBeenCalled();
  await fireEvent(screen.getByTestId('received-yarn-modal'), 'show');
  await tick();
  expect(receivedYarn.markSeen).toHaveBeenCalledWith(
    'summary-1',
    expect.any(AbortSignal),
  );
  expect(screen.getByText('털실 3개가 도착했어요')).toBeTruthy();
  await press('받은 털실 닫기');
  expect(screen.queryByTestId('received-yarn-modal')).toBeNull();
  expect(screen.getByText('나의 양떼')).toBeTruthy();
});

it.each(['none', 'zero', 'seen'] as const)(
  'omits popup and confirmation for %s summaries without blocking home',
  async (scenario) => {
    const { load, seen } = await open(scenario);
    expect(screen.getByText('나의 양떼')).toBeTruthy();
    expect(screen.queryByTestId('received-yarn-modal')).toBeNull();
    expect(load).toHaveBeenCalledTimes(1);
    expect(seen).not.toHaveBeenCalled();
    expect(screen.queryByText('받은 털실을 확인하고 있어요')).toBeNull();
    expect(screen.queryByText('받은 털실을 불러오지 못했어요')).toBeNull();
  },
);

it('retries only the failed summary read and leaves the adopted sheep available', async () => {
  const { load, seen } = await open('load-retry');
  expect(screen.getByText('나의 양떼')).toBeTruthy();
  expect(screen.getByText('받은 털실을 불러오지 못했어요')).toBeTruthy();
  expect(screen.queryByTestId('received-yarn-modal')).toBeNull();
  expect(seen).not.toHaveBeenCalled();
  await press('받은 털실 다시 불러오기');
  await tick();
  expect(screen.getByText('털실 3개가 도착했어요')).toBeTruthy();
  expect(load).toHaveBeenCalledTimes(2);
  expect(seen).not.toHaveBeenCalled();
  await shown();
  await tick();
  expect(seen).toHaveBeenCalledTimes(1);
});

it('does not repeat a confirmation on duplicate presentation events, retries the same ID and stays hidden on reentry', async () => {
  const { actions, seen, view } = await open('seen-retry');
  await shown();
  await shown();
  await tick();
  expect(seen).toHaveBeenCalledTimes(1);
  expect(screen.getByText('확인 상태가 저장됐는지 알 수 없어요.')).toBeTruthy();
  await shown();
  await tick();
  expect(seen).toHaveBeenCalledTimes(1);
  await press('확인 상태 다시 저장');
  await tick();
  expect(seen.mock.calls.map(([id]) => id)).toEqual([
    'preview-yarn-summary',
    'preview-yarn-summary',
  ]);
  expect(screen.getByText('털실 3개가 도착했어요')).toBeTruthy();
  await shown();
  await tick();
  expect(seen).toHaveBeenCalledTimes(2);
  await press('받은 털실 닫기');
  await view.unmount();
  await render(<MorningScreen actions={actions} onExit={() => {}} />);
  await tick();
  expect(screen.getByText('나의 양떼')).toBeTruthy();
  expect(screen.queryByTestId('received-yarn-modal')).toBeNull();
});

it('keeps a pending seen request alive after closing and offers retry in home if it fails', async () => {
  const { seen } = await open();
  let reject!: (error: Error) => void;
  seen.mockImplementationOnce(
    () =>
      new Promise((_resolve, no) => {
        reject = no;
      }),
  );
  await shown();
  const signal = seen.mock.calls[0][1];
  await fireEvent(screen.getByTestId('received-yarn-modal'), 'requestClose');
  expect(signal.aborted).toBe(false);
  expect(screen.getByText('나의 양떼')).toBeTruthy();
  await act(async () => reject(new ApiError('network')));
  expect(screen.getByText('확인 상태가 저장됐는지 알 수 없어요.')).toBeTruthy();
  await press('어젯밤 돌아보기');
  await tick();
  expect(screen.getByTestId('reflection-modal')).toBeTruthy();
  await fireEvent(screen.getByTestId('reflection-modal'), 'requestClose');
  await press('확인 상태 다시 저장');
  await tick();
  expect(seen).toHaveBeenCalledTimes(2);
  expect(screen.queryByText('확인 상태가 저장됐는지 알 수 없어요.')).toBeNull();
  expect(screen.queryByTestId('received-yarn-modal')).toBeNull();
});

it('recovers a lost seen response idempotently and leaves the popup readable until dismissal', async () => {
  const { received, seen } = await open('seen-lost');
  await shown();
  await tick();
  expect(screen.getByText('확인 상태가 저장됐는지 알 수 없어요.')).toBeTruthy();
  const read = received.load(new AbortController().signal);
  await tick();
  expect(await read).toBeNull();
  expect(screen.getByText('털실 3개가 도착했어요')).toBeTruthy();
  await press('확인 상태 다시 저장');
  await tick();
  expect(seen).toHaveBeenCalledTimes(2);
  expect(screen.queryByText('확인 상태가 저장됐는지 알 수 없어요.')).toBeNull();
  expect(screen.getByText('털실 3개가 도착했어요')).toBeTruthy();
});

it('does not acknowledge a popup dismissed before its native presentation event', async () => {
  const { actions, seen, view } = await open();
  await press('받은 털실 닫기');
  expect(seen).not.toHaveBeenCalled();
  await view.unmount();
  await render(<MorningScreen actions={actions} onExit={() => {}} />);
  await tick();
  expect(screen.getByText('털실 3개가 도착했어요')).toBeTruthy();
  expect(seen).not.toHaveBeenCalled();
});

it('aborts uncommitted seen on exit and allows the same summary to appear on reentry', async () => {
  const { actions, seen, view } = await open('slow-seen');
  await shown();
  const signal = seen.mock.calls[0][1];
  await view.unmount();
  expect(signal.aborted).toBe(true);
  await tick();
  await render(<MorningScreen actions={actions} onExit={() => {}} />);
  await tick();
  expect(screen.getByText('털실 3개가 도착했어요')).toBeTruthy();
  await shown();
  await tick();
  expect(seen).toHaveBeenCalledTimes(2);
});

it.each([
  ['id', '   '],
  ['date', '2026-02-30'],
  ['yarn_count', -1],
  ['yarn_count', 1.5],
  ['yarn_count', Number.MAX_SAFE_INTEGER + 1],
  ['sender_count', -1],
  ['sender_count', 4],
  ['sender_count', 0],
] as const)(
  'rejects an invalid %s=%s without presenting or acknowledging it',
  async (field, invalid) => {
    jest.useFakeTimers();
    const received: ReceivedYarnActions = {
      load: async () =>
        ({ ...summary, [field]: invalid }) as unknown as typeof summary,
      markSeen: jest
        .fn<ReceivedYarnActions['markSeen']>()
        .mockResolvedValue(undefined),
    };
    const actions = {
      ...createMockMorning('existing'),
      receivedYarn: received,
    };
    await render(<MorningScreen actions={actions} onExit={() => {}} />);
    await tick();
    expect(screen.getByText('받은 털실을 불러오지 못했어요')).toBeTruthy();
    expect(screen.queryByTestId('received-yarn-modal')).toBeNull();
    expect(received.markSeen).not.toHaveBeenCalled();
  },
);

it('formats large yarn and sender counts independently', async () => {
  await open('large');
  expect(screen.getByText('털실 1,234,567개가 도착했어요')).toBeTruthy();
  expect(
    screen.getByText('123,456명이 당신의 카드에 마음을 보냈어요.'),
  ).toBeTruthy();
});

it.each([1, 3])(
  'accepts %s distinct senders for three received yarn reactions',
  async (count) => {
    jest.useFakeTimers();
    const received: ReceivedYarnActions = {
      load: async () => ({ ...summary, sender_count: count }),
      markSeen: jest
        .fn<ReceivedYarnActions['markSeen']>()
        .mockResolvedValue(undefined),
    };
    const actions = {
      ...createMockMorning('existing'),
      receivedYarn: received,
    };
    await render(<MorningScreen actions={actions} onExit={() => {}} />);
    await tick();
    expect(screen.getByText('털실 3개가 도착했어요')).toBeTruthy();
    expect(
      screen.getByText(`${count}명이 당신의 카드에 마음을 보냈어요.`),
    ).toBeTruthy();
    await shown();
    await tick();
    expect(received.markSeen).toHaveBeenCalledTimes(1);
  },
);

it.each(['reflection', 'songs', 'detail', 'writing'] as const)(
  'waits for the %s modal to close before presenting and acknowledging the summary',
  async (overlay) => {
    jest.useFakeTimers();
    let resolve!: (value: typeof summary) => void;
    const received: ReceivedYarnActions = {
      load: () =>
        new Promise((yes) => {
          resolve = yes;
        }),
      markSeen: jest
        .fn<ReceivedYarnActions['markSeen']>()
        .mockResolvedValue(undefined),
    };
    const base = createMockMorning('existing');
    const actions: MorningActions = {
      ...base,
      receivedYarn: received,
      loadMorning: async (signal) => ({
        ...(await base.loadMorning(signal)),
        writing_offer: { state: 'deferred' },
      }),
      songs: { load: async () => [], set: async (_id, saved) => saved },
      writing: createMockCardWriting(
        createMockTextCards(),
        createMockSongCards(),
      ),
    };
    await render(
      <MorningScreen
        actions={actions}
        loadDetail={base.loadSheep}
        onExit={() => {}}
      />,
    );
    await tick();
    if (overlay === 'reflection') await press('어젯밤 돌아보기');
    if (overlay === 'songs') await press('담은 노래 보기');
    if (overlay === 'detail')
      await fireEvent.press(
        screen.getAllByRole('button', { name: /의 양/ })[0],
      );
    if (overlay === 'writing') await press('미뤄 둔 카드 쓰기');
    await act(async () => resolve(summary));
    await tick();
    expect(screen.queryByTestId('received-yarn-modal')).toBeNull();
    expect(received.markSeen).not.toHaveBeenCalled();
    const id =
      overlay === 'reflection'
        ? 'reflection-modal'
        : overlay === 'songs'
          ? 'saved-songs-modal'
          : overlay === 'detail'
            ? 'sheep-detail-modal'
            : 'card-writing-modal';
    await fireEvent(screen.getByTestId(id), 'requestClose');
    await tick();
    expect(screen.getByText('털실 3개가 도착했어요')).toBeTruthy();
    expect(received.markSeen).not.toHaveBeenCalled();
    await shown();
    await tick();
    expect(received.markSeen).toHaveBeenCalledTimes(1);
  },
);

it.each([
  ['load', 'success'],
  ['load', 'failure'],
  ['seen', 'success'],
  ['seen', 'failure'],
] as const)(
  'aborts old %s on source replacement and ignores its late %s',
  async (stage, outcome) => {
    jest.useFakeTimers();
    let finish!: () => void, oldSignal!: AbortSignal;
    const received: ReceivedYarnActions = {
      load: async () => summary,
      markSeen: async () => {},
    };
    if (stage === 'load')
      received.load = (sig) => {
        oldSignal = sig;
        return new Promise((resolve, reject) => {
          finish = () =>
            outcome === 'success'
              ? resolve(summary)
              : reject(new ApiError('network'));
        });
      };
    else
      received.markSeen = (_id, sig) => {
        oldSignal = sig;
        return new Promise((resolve, reject) => {
          finish = () =>
            outcome === 'success' ? resolve() : reject(new ApiError('network'));
        });
      };
    const actions = {
      ...createMockMorning('existing'),
      receivedYarn: received,
    };
    const view = await render(
      <MorningScreen actions={actions} onExit={() => {}} />,
    );
    await tick();
    if (stage === 'seen') await shown();
    const nextReceived = createMockReceivedYarn('none'),
      next = { ...createMockMorning('existing'), receivedYarn: nextReceived };
    const nextSeen = jest.spyOn(nextReceived, 'markSeen');
    await view.rerender(<MorningScreen actions={next} onExit={() => {}} />);
    await tick();
    expect(oldSignal.aborted).toBe(true);
    await act(async () => finish());
    expect(screen.getByText('나의 양떼')).toBeTruthy();
    expect(screen.queryByTestId('received-yarn-modal')).toBeNull();
    expect(
      screen.queryByText('확인 상태가 저장됐는지 알 수 없어요.'),
    ).toBeNull();
    expect(nextSeen).not.toHaveBeenCalled();
  },
);

it('does not let a flock load failure block the independent summary', async () => {
  jest.useFakeTimers();
  const received = createMockReceivedYarn(),
    base = createMockMorning('existing');
  const load = jest.spyOn(received, 'load');
  jest
    .spyOn(base, 'loadFlock')
    .mockRejectedValueOnce(new ApiError('network'))
    .mockResolvedValue([]);
  await render(
    <MorningScreen
      actions={{ ...base, receivedYarn: received }}
      onExit={() => {}}
    />,
  );
  await tick();
  expect(screen.getByText('털실 3개가 도착했어요')).toBeTruthy();
  await shown();
  await tick();
  await press('받은 털실 닫기');
  expect(screen.getByText(/양떼를 모두 불러오지 못했어요/)).toBeTruthy();
  await press('양떼 다시 불러오기');
  await tick();
  expect(load).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(/양떼를 모두 불러오지 못했어요/)).toBeNull();
});

it('waits until foreground before presenting or acknowledging a summary loaded in background', async () => {
  jest.useFakeTimers();
  const previous = AppState.currentState;
  let change!: (state: AppStateStatus) => void;
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, listener) => {
      change = listener;
      return { remove: () => {} };
    });
  Object.defineProperty(AppState, 'currentState', {
    value: 'background',
    configurable: true,
    writable: true,
  });
  try {
    const received = createMockReceivedYarn(),
      seen = jest.spyOn(received, 'markSeen');
    const actions = {
      ...createMockMorning('existing'),
      receivedYarn: received,
    };
    await render(<MorningScreen actions={actions} onExit={() => {}} />);
    await tick();
    expect(screen.getByText('나의 양떼')).toBeTruthy();
    expect(screen.queryByTestId('received-yarn-modal')).toBeNull();
    expect(seen).not.toHaveBeenCalled();
    Object.defineProperty(AppState, 'currentState', {
      value: 'active',
      configurable: true,
      writable: true,
    });
    await act(async () => change('active'));
    await tick();
    expect(screen.getByText('털실 3개가 도착했어요')).toBeTruthy();
    expect(seen).not.toHaveBeenCalled();
    await shown();
    await tick();
    expect(seen).toHaveBeenCalledTimes(1);
  } finally {
    Object.defineProperty(AppState, 'currentState', {
      value: previous,
      configurable: true,
      writable: true,
    });
  }
});

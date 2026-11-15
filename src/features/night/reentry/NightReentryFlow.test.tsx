import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Linking, Platform } from 'react-native';
import type { Card, Support } from '../../../api/contracts';
import { ApiError } from '../../../api/errors';
import { NightReentryFlow } from './NightReentryFlow';
import type { ReentryActions, ReentryBootstrap, ReentrySession } from './model';
const support: Support = {
  message: '도움 안내 예시',
  resources: [
    { action: 'open_contacts', label: '연락처 앱 열기', target: null },
  ],
};
const bootstrap: ReentryBootstrap = {
  phase: 'night',
  next_screen: 'NIGHT_FEED',
  night_id: 'night-1',
  active_session_id: 'session-1',
  support: null,
};
const session: ReentrySession = {
  id: 'session-1',
  night_id: 'night-1',
  status: 'active',
  sheep_count: 6,
  position: 2,
  furthest_position: 4,
  sequence: 0,
  writer_epoch: 2,
};
const cards: Card[] = Array.from({ length: 6 }, (_, i) => ({
  id: `card-${i + 1}`,
  kind: 'text',
  tone: 'empathy',
  category_id: 'career',
  author_type: 'seed',
  author_label: '예시 양',
  available: true,
  viewer: { yarn_sent: false, fluff_saved: false, song_saved: false },
  content: { text: `저장된 카드 ${i + 1}` },
}));
function api(route: ReentryBootstrap = bootstrap) {
  return {
    bootstrap: jest.fn<ReentryActions['bootstrap']>().mockResolvedValue(route),
    checkWorry: jest
      .fn<ReentryActions['checkWorry']>()
      .mockResolvedValue({ id: 'night-1', status: 'ready', support: null }),
    continueSupport: jest
      .fn<ReentryActions['continueSupport']>()
      .mockResolvedValue({ id: 'night-1', active_session_id: 'session-1' }),
    resume: jest.fn<ReentryActions['resume']>().mockResolvedValue(session),
    createSession: jest
      .fn<ReentryActions['createSession']>()
      .mockResolvedValue({
        ...session,
        sheep_count: 3,
        position: 0,
        furthest_position: 0,
        writer_epoch: 1,
      }),
    loadFeed: jest.fn<ReentryActions['loadFeed']>().mockResolvedValue(cards),
    rememberPosition: jest.fn<ReentryActions['rememberPosition']>(),
  };
}
const press = (label: string) =>
  fireEvent.press(screen.getByRole('button', { name: label }));
beforeEach(() => {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
});
afterEach(() => {
  jest.restoreAllMocks();
});

it('resumes the existing session at the saved current card and keeps the furthest position when moving back', async () => {
  const actions = api();
  await render(<NightReentryFlow actions={actions} onExit={() => {}} />);
  expect(screen.getByText('2 / 6')).toBeTruthy();
  expect(screen.getByText('저장된 카드 2')).toBeTruthy();
  expect(actions.resume).toHaveBeenCalledWith(
    'session-1',
    expect.any(AbortSignal),
  );
  expect(actions.createSession).not.toHaveBeenCalled();
  await press('이전 양');
  expect(screen.getByText('1 / 6')).toBeTruthy();
  expect(actions.rememberPosition).toHaveBeenLastCalledWith(session, {
    position: 1,
    furthestPosition: 4,
  });
  await press('미리보기 나가기');
  expect(
    screen.getByRole('button', { name: '밤 상태 다시 확인' }),
  ).toBeTruthy();
});
it('shows the first card only after an untouched session feed has loaded', async () => {
  const actions = api();
  actions.resume.mockResolvedValue({
    ...session,
    position: 0,
    furthest_position: 0,
  });
  let resolve!: (cards: Card[]) => void;
  actions.loadFeed.mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  await render(<NightReentryFlow actions={actions} onExit={() => {}} />);
  expect(actions.rememberPosition).not.toHaveBeenCalled();
  await act(async () => resolve(cards));
  expect(screen.getByText('1 / 6')).toBeTruthy();
  expect(actions.rememberPosition).toHaveBeenLastCalledWith(
    expect.objectContaining({ position: 0 }),
    { position: 1, furthestPosition: 1 },
  );
});
it('skips worry input for a recorded night, creates the chosen new session once, and does not resume that new session', async () => {
  const actions = api({
    ...bootstrap,
    next_screen: 'NIGHT_SHEEP_COUNT',
    active_session_id: null,
  });
  actions.loadFeed.mockResolvedValue(cards.slice(0, 3));
  await render(<NightReentryFlow actions={actions} onExit={() => {}} />);
  expect(screen.queryByLabelText('오늘의 고민')).toBeNull();
  await fireEvent.press(screen.getByRole('radio', { name: '3마리' }));
  await press('양 세기 시작');
  expect(screen.getByText('1 / 3')).toBeTruthy();
  expect(actions.createSession).toHaveBeenCalledWith(
    'night-1',
    3,
    expect.any(AbortSignal),
  );
  expect(actions.resume).not.toHaveBeenCalled();
  expect(actions.checkWorry).not.toHaveBeenCalled();
});
it('allows first worry input and uses the returned night id for creation', async () => {
  const actions = api({
    ...bootstrap,
    next_screen: 'NIGHT_WORRY',
    night_id: null,
    active_session_id: null,
  });
  actions.checkWorry.mockResolvedValue({
    id: 'created-night',
    status: 'ready',
    support: null,
  });
  actions.createSession.mockResolvedValue({
    ...session,
    night_id: 'created-night',
    sheep_count: 3,
    position: 0,
    furthest_position: 0,
  });
  actions.loadFeed.mockResolvedValue(cards.slice(0, 3));
  await render(<NightReentryFlow actions={actions} onExit={() => {}} />);
  await fireEvent.press(screen.getByRole('radio', { name: '고민 없음' }));
  await press('다음');
  await fireEvent.press(screen.getByRole('radio', { name: '3마리' }));
  await press('양 세기 시작');
  expect(actions.createSession).toHaveBeenCalledWith(
    'created-night',
    3,
    expect.any(AbortSignal),
  );
  expect(screen.getByText('1 / 3')).toBeTruthy();
});
it('does not reopen an editable worry after its first successful recording', async () => {
  const actions = api({
    ...bootstrap,
    next_screen: 'NIGHT_WORRY',
    night_id: null,
    active_session_id: null,
  });
  await render(<NightReentryFlow actions={actions} onExit={() => {}} />);
  await fireEvent.press(screen.getByRole('radio', { name: '고민 없음' }));
  await press('다음');
  await press('뒤로');
  expect(screen.queryByLabelText('오늘의 고민')).toBeNull();
  expect(
    screen.getByRole('button', { name: '밤 상태 다시 확인' }),
  ).toBeTruthy();
});
it('routes a newly recorded support-needed night through continue to the current existing session', async () => {
  const actions = api({
    ...bootstrap,
    next_screen: 'NIGHT_WORRY',
    night_id: null,
    active_session_id: null,
  });
  actions.checkWorry.mockResolvedValue({
    id: 'night-1',
    status: 'needs_support',
    support,
  });
  await render(<NightReentryFlow actions={actions} onExit={() => {}} />);
  await fireEvent.press(screen.getByRole('radio', { name: '고민 없음' }));
  await press('다음');
  expect(actions.resume).not.toHaveBeenCalled();
  await press('계속하기');
  expect(screen.getByText('2 / 6')).toBeTruthy();
  expect(actions.createSession).not.toHaveBeenCalled();
});
it('keeps support on external-app return and resumes only the session returned by explicit continue without a second bootstrap', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  const actions = api({
    ...bootstrap,
    next_screen: 'NIGHT_SUPPORT',
    support,
    active_session_id: 'older-session',
  });
  await render(<NightReentryFlow actions={actions} onExit={() => {}} />);
  expect(actions.resume).not.toHaveBeenCalled();
  await press('연락처 앱 열기');
  expect(screen.getByText('도움 안내 예시')).toBeTruthy();
  expect(actions.bootstrap).toHaveBeenCalledTimes(1);
  expect(actions.continueSupport).not.toHaveBeenCalled();
  await press('계속하기');
  expect(screen.getByText('2 / 6')).toBeTruthy();
  expect(actions.resume).toHaveBeenCalledWith(
    'session-1',
    expect.any(AbortSignal),
  );
  expect(actions.bootstrap).toHaveBeenCalledTimes(1);
  expect(actions.createSession).not.toHaveBeenCalled();
});
it('uses a null continue result to open count selection without asking for the worry again', async () => {
  const actions = api({ ...bootstrap, next_screen: 'NIGHT_SUPPORT', support });
  actions.continueSupport.mockResolvedValue({
    id: 'night-1',
    active_session_id: null,
  });
  await render(<NightReentryFlow actions={actions} onExit={() => {}} />);
  await press('계속하기');
  expect(screen.getByText('오늘은 몇 마리 셀까요?')).toBeTruthy();
  expect(screen.queryByLabelText('오늘의 고민')).toBeNull();
  expect(actions.resume).not.toHaveBeenCalled();
});
it('retries a failed resume for the same id without repeating continue or creating another session', async () => {
  const actions = api({ ...bootstrap, next_screen: 'NIGHT_SUPPORT', support });
  actions.resume.mockRejectedValueOnce(new Error('private server detail'));
  await render(<NightReentryFlow actions={actions} onExit={() => {}} />);
  await press('계속하기');
  expect(screen.queryByText('private server detail')).toBeNull();
  await press('다시 시도');
  expect(screen.getByText('2 / 6')).toBeTruthy();
  expect(actions.resume).toHaveBeenCalledTimes(2);
  expect(actions.resume.mock.calls.map(([id]) => id)).toEqual([
    'session-1',
    'session-1',
  ]);
  expect(actions.continueSupport).toHaveBeenCalledTimes(1);
  expect(actions.bootstrap).toHaveBeenCalledTimes(1);
  expect(actions.createSession).not.toHaveBeenCalled();
});
it('requires fresh state after SESSION_CLOSED instead of repeatedly resuming a closed session', async () => {
  const actions = api();
  actions.resume.mockRejectedValueOnce(
    new ApiError('http', { status: 409, code: 'SESSION_CLOSED' }),
  );
  actions.bootstrap.mockResolvedValueOnce(bootstrap).mockResolvedValue({
    ...bootstrap,
    phase: 'day',
    next_screen: 'HOME',
    active_session_id: null,
  });
  await render(<NightReentryFlow actions={actions} onExit={() => {}} />);
  expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull();
  await press('밤 상태 다시 확인');
  expect(screen.getByText('지금은 이 밤을 이어 볼 수 없어요')).toBeTruthy();
  expect(actions.resume).toHaveBeenCalledTimes(1);
  expect(actions.createSession).not.toHaveBeenCalled();
});
it('does not send a valid day or closing route back to worry input when it is outside this preview', async () => {
  const actions = api({
    ...bootstrap,
    phase: 'day',
    next_screen: 'HOME',
    active_session_id: null,
  });
  await render(<NightReentryFlow actions={actions} onExit={() => {}} />);
  expect(screen.getByText('지금은 이 밤을 이어 볼 수 없어요')).toBeTruthy();
  expect(screen.queryByLabelText('오늘의 고민')).toBeNull();
  expect(actions.resume).not.toHaveBeenCalled();
  expect(actions.checkWorry).not.toHaveBeenCalled();
});
it('does not pass a missing support payload and recovers by explicitly reloading state', async () => {
  const actions = api({ ...bootstrap, next_screen: 'NIGHT_SUPPORT', support });
  actions.bootstrap.mockResolvedValueOnce({
    ...bootstrap,
    next_screen: 'NIGHT_SUPPORT',
    support: null,
  });
  await render(<NightReentryFlow actions={actions} onExit={() => {}} />);
  expect(screen.getByRole('button', { name: '계속하기' })).toBeDisabled();
  await press('도움 안내 다시 불러오기');
  expect(screen.getByText('도움 안내 예시')).toBeTruthy();
  expect(screen.getByRole('button', { name: '계속하기' })).toBeEnabled();
  expect(actions.resume).not.toHaveBeenCalled();
});
it('leaves a missing-support retry when fresh state is a valid day route', async () => {
  const actions = api({
    ...bootstrap,
    next_screen: 'NIGHT_SUPPORT',
    support: null,
  });
  actions.bootstrap
    .mockResolvedValueOnce({
      ...bootstrap,
      next_screen: 'NIGHT_SUPPORT',
      support: null,
    })
    .mockResolvedValue({
      ...bootstrap,
      phase: 'day',
      next_screen: 'HOME',
      active_session_id: null,
    });
  await render(<NightReentryFlow actions={actions} onExit={() => {}} />);
  await press('도움 안내 다시 불러오기');
  expect(screen.getByText('지금은 이 밤을 이어 볼 수 없어요')).toBeTruthy();
  expect(actions.continueSupport).not.toHaveBeenCalled();
  expect(actions.resume).not.toHaveBeenCalled();
});
it.each(['bootstrap', 'resume', 'continueSupport'] as const)(
  'aborts %s on source replacement and ignores its late success',
  async (phase) => {
    const old = api(
        phase === 'continueSupport'
          ? { ...bootstrap, next_screen: 'NIGHT_SUPPORT', support }
          : bootstrap,
      ),
      next = api({
        ...bootstrap,
        next_screen: 'NIGHT_SHEEP_COUNT',
        active_session_id: null,
      });
    let resolve!: (v: never) => void;
    old[phase].mockImplementationOnce(
      () =>
        new Promise<never>((r) => {
          resolve = r;
        }),
    );
    const view = await render(
      <NightReentryFlow actions={old} onExit={() => {}} />,
    );
    if (phase === 'continueSupport') await press('계속하기');
    const args = old[phase].mock.calls[0];
    const signal = args[args.length - 1] as AbortSignal;
    await view.rerender(<NightReentryFlow actions={next} onExit={() => {}} />);
    expect(signal.aborted).toBe(true);
    await act(async () =>
      resolve(
        (phase === 'bootstrap'
          ? bootstrap
          : phase === 'resume'
            ? session
            : { id: 'night-1', active_session_id: 'session-1' }) as never,
      ),
    );
    expect(screen.getByText('오늘은 몇 마리 셀까요?')).toBeTruthy();
    expect(screen.queryByText('2 / 6')).toBeNull();
    expect(old.loadFeed).not.toHaveBeenCalled();
  },
);
it('blocks duplicate continue, cancels on back, and ignores a late failure', async () => {
  const actions = api({ ...bootstrap, next_screen: 'NIGHT_SUPPORT', support });
  let reject!: (error: Error) => void;
  actions.continueSupport.mockImplementation(
    () =>
      new Promise((_, r) => {
        reject = r;
      }),
  );
  await render(<NightReentryFlow actions={actions} onExit={() => {}} />);
  await press('계속하기');
  await press('계속하는 중');
  expect(actions.continueSupport).toHaveBeenCalledTimes(1);
  await press('재진입 나가기');
  expect(actions.continueSupport.mock.calls[0][1].aborted).toBe(true);
  await act(async () => reject(new Error('late failure')));
  expect(
    screen.getByRole('button', { name: '밤 상태 다시 확인' }),
  ).toBeTruthy();
  expect(screen.queryByText(/계속하기 응답을 확인하지/)).toBeNull();
  expect(actions.resume).not.toHaveBeenCalled();
});
it('rejects wrong-night continue responses and allows an explicit retry with the same night', async () => {
  const actions = api({ ...bootstrap, next_screen: 'NIGHT_SUPPORT', support });
  actions.continueSupport.mockResolvedValueOnce({
    id: 'other-night',
    active_session_id: 'session-1',
  });
  await render(<NightReentryFlow actions={actions} onExit={() => {}} />);
  await press('계속하기');
  expect(actions.resume).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent(/계속하기/);
  await press('계속하기');
  expect(screen.getByText('2 / 6')).toBeTruthy();
  expect(actions.continueSupport.mock.calls.map(([id]) => id)).toEqual([
    'night-1',
    'night-1',
  ]);
});
it('does not remember progress from an invalid-length feed and retries only feed loading', async () => {
  const actions = api();
  actions.loadFeed.mockResolvedValueOnce(cards.slice(0, 3));
  await render(<NightReentryFlow actions={actions} onExit={() => {}} />);
  expect(screen.getByText('카드를 불러오지 못했어요')).toBeTruthy();
  expect(actions.rememberPosition).not.toHaveBeenCalled();
  await press('다시 시도');
  expect(screen.getByText('2 / 6')).toBeTruthy();
  expect(actions.resume).toHaveBeenCalledTimes(1);
});
it.each([
  { ...cards[0], kind: 'unknown' },
  { ...cards[0], content: {} },
])(
  'does not render or remember malformed card content (%p)',
  async (invalid) => {
    const actions = api();
    actions.loadFeed.mockResolvedValueOnce([
      invalid,
      ...cards.slice(1),
    ] as Card[]);
    await render(<NightReentryFlow actions={actions} onExit={() => {}} />);
    expect(screen.getByText('카드를 불러오지 못했어요')).toBeTruthy();
    expect(actions.rememberPosition).not.toHaveBeenCalled();
    await press('다시 시도');
    expect(screen.getByText('2 / 6')).toBeTruthy();
  },
);
it('can leave a pending resume and requery without an old completion overwriting the latest route', async () => {
  const actions = api();
  let resolve!: (value: ReentrySession) => void;
  actions.resume.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  actions.bootstrap.mockResolvedValueOnce(bootstrap).mockResolvedValue({
    ...bootstrap,
    next_screen: 'NIGHT_SHEEP_COUNT',
    active_session_id: null,
  });
  await render(<NightReentryFlow actions={actions} onExit={() => {}} />);
  await press('재진입 나가기');
  expect(actions.resume.mock.calls[0][1].aborted).toBe(true);
  await press('밤 상태 다시 확인');
  await act(async () => resolve(session));
  expect(screen.getByText('오늘은 몇 마리 셀까요?')).toBeTruthy();
  expect(actions.loadFeed).not.toHaveBeenCalled();
});
it('does not remember a late feed response after leaving', async () => {
  const actions = api();
  let resolve!: (value: Card[]) => void;
  actions.loadFeed.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  await render(<NightReentryFlow actions={actions} onExit={() => {}} />);
  await press('미리보기 나가기');
  expect(actions.loadFeed.mock.calls[0][1].aborted).toBe(true);
  await act(async () => resolve(cards));
  expect(actions.rememberPosition).not.toHaveBeenCalled();
  expect(
    screen.getByRole('button', { name: '밤 상태 다시 확인' }),
  ).toBeTruthy();
});
it('aborts an old creation on source replacement without using its late session', async () => {
  const old = api({
      ...bootstrap,
      next_screen: 'NIGHT_SHEEP_COUNT',
      active_session_id: null,
    }),
    next = api();
  let resolve!: (value: ReentrySession) => void;
  old.createSession.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const view = await render(
    <NightReentryFlow actions={old} onExit={() => {}} />,
  );
  await fireEvent.press(screen.getByRole('radio', { name: '3마리' }));
  await press('양 세기 시작');
  await view.rerender(<NightReentryFlow actions={next} onExit={() => {}} />);
  expect(old.createSession.mock.calls[0][2].aborted).toBe(true);
  await act(async () =>
    resolve({ ...session, sheep_count: 3, position: 0, furthest_position: 0 }),
  );
  expect(screen.getByText('2 / 6')).toBeTruthy();
  expect(old.loadFeed).not.toHaveBeenCalled();
});
it('keeps the selected count when a create response silently uses a different count', async () => {
  const actions = api({
    ...bootstrap,
    next_screen: 'NIGHT_SHEEP_COUNT',
    active_session_id: null,
  });
  actions.createSession.mockResolvedValue({
    ...session,
    position: 0,
    furthest_position: 0,
  });
  await render(<NightReentryFlow actions={actions} onExit={() => {}} />);
  await fireEvent.press(screen.getByRole('radio', { name: '3마리' }));
  await press('양 세기 시작');
  expect(screen.getByRole('alert')).toBeTruthy();
  expect(screen.getByLabelText('선택한 양 수')).toHaveTextContent('3마리');
  expect(actions.loadFeed).not.toHaveBeenCalled();
});

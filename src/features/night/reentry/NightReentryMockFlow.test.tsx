import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { ApiError } from '../../../api/errors';
import { createMockNightReentry } from '../../../mocks/nightReentry';
import { NightReentryFlow } from './NightReentryFlow';
const press = (label: string) =>
  fireEvent.press(screen.getByRole('button', { name: label }));
async function settle() {
  for (let i = 0; i < 5; i++)
    await act(async () => {
      await jest.advanceTimersByTimeAsync(800);
    });
}
beforeEach(() => {
  jest.useFakeTimers();
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
it('moves back then explicitly reenters the same saved card while keeping the maximum viewed range', async () => {
  const actions = createMockNightReentry('active'),
    create = jest.spyOn(actions, 'createSession');
  await render(<NightReentryFlow actions={actions} onExit={() => {}} />);
  await settle();
  expect(screen.getByText('2 / 6')).toBeTruthy();
  await press('이전 양');
  expect(screen.getByText('1 / 6')).toBeTruthy();
  await press('미리보기 나가기');
  expect(screen.getByText(/본 양은 최대 4마리/)).toBeTruthy();
  await press('밤 상태 다시 확인');
  await settle();
  expect(screen.getByText('1 / 6')).toBeTruthy();
  await press('미리보기 나가기');
  expect(screen.getByText(/본 양은 최대 4마리/)).toBeTruthy();
  expect(create).not.toHaveBeenCalled();
});
it('records a first worry, creates once, then uses resume on reentry without asking for another worry', async () => {
  const actions = createMockNightReentry('new'),
    create = jest.spyOn(actions, 'createSession'),
    resume = jest.spyOn(actions, 'resume');
  await render(<NightReentryFlow actions={actions} onExit={() => {}} />);
  await settle();
  await fireEvent.press(screen.getByRole('radio', { name: '고민 없음' }));
  await press('다음');
  await settle();
  await fireEvent.press(screen.getByRole('radio', { name: '3마리' }));
  await press('양 세기 시작');
  await settle();
  expect(screen.getByText('1 / 3')).toBeTruthy();
  expect(create).toHaveBeenCalledTimes(1);
  expect(resume).not.toHaveBeenCalled();
  await press('미리보기 나가기');
  await press('밤 상태 다시 확인');
  await settle();
  expect(screen.getByText('1 / 3')).toBeTruthy();
  expect(create).toHaveBeenCalledTimes(1);
  expect(resume).toHaveBeenCalledTimes(1);
  expect(screen.queryByLabelText('오늘의 고민')).toBeNull();
});

function loseCreationReply(error: Error, newNight = false) {
  const actions = createMockNightReentry(newNight ? 'new' : 'recorded');
  const original = actions.createSession;
  const create = jest
    .spyOn(actions, 'createSession')
    .mockImplementationOnce(async (...args) => {
      await original(...args);
      throw error;
    });
  return {
    actions,
    create,
    bootstrap: jest.spyOn(actions, 'bootstrap'),
    resume: jest.spyOn(actions, 'resume'),
  };
}
async function startThree(
  actions: ReturnType<typeof createMockNightReentry>,
  newNight = false,
) {
  await render(<NightReentryFlow actions={actions} onExit={() => {}} />);
  await settle();
  if (newNight) {
    await fireEvent.press(screen.getByRole('radio', { name: '고민 없음' }));
    await press('다음');
    await settle();
  }
  await fireEvent.press(screen.getByRole('radio', { name: '3마리' }));
  await press('양 세기 시작');
  await settle();
}
it.each([
  new ApiError('network'),
  new ApiError('timeout'),
  new ApiError('invalid-response'),
  new ApiError('http', { status: 409, code: 'ACTIVE_SESSION_EXISTS' }),
  new ApiError('http', { status: 503, code: 'FEED_BUILD_UNAVAILABLE' }),
  new ApiError('http', { status: 500, code: 'VALIDATION_ERROR' }),
])(
  'recovers a committed creation with an unconfirmed reply through explicit state lookup without recreating (%p)',
  async (error) => {
    const { actions, create, bootstrap, resume } = loseCreationReply(
      error,
      true,
    );
    await startThree(actions, true);
    expect(
      screen.getByText('양 세기 준비 결과를 확인하지 못했어요'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull();
    expect(create).toHaveBeenCalledTimes(1);
    expect(bootstrap).toHaveBeenCalledTimes(1);
    expect(resume).not.toHaveBeenCalled();
    await press('밤 상태 다시 확인');
    await settle();
    expect(screen.getByText('1 / 3')).toBeTruthy();
    expect(screen.queryByLabelText('오늘의 고민')).toBeNull();
    expect(create).toHaveBeenCalledTimes(1);
    expect(bootstrap).toHaveBeenCalledTimes(2);
    expect(resume).toHaveBeenCalledTimes(1);
    expect(resume).toHaveBeenCalledWith(
      'reentry-session-1',
      expect.any(AbortSignal),
    );
  },
);
it('retries only lookup after a recovery lookup fails and eventually enters the already-created session', async () => {
  const { actions, create, bootstrap, resume } = loseCreationReply(
    new ApiError('network'),
  );
  await startThree(actions);
  bootstrap.mockRejectedValueOnce(new ApiError('network'));
  await press('밤 상태 다시 확인');
  await settle();
  expect(
    screen.getByText('양 세기 준비 결과를 확인하지 못했어요'),
  ).toBeTruthy();
  expect(create).toHaveBeenCalledTimes(1);
  expect(resume).not.toHaveBeenCalled();
  await press('밤 상태 다시 확인');
  await settle();
  expect(screen.getByText('1 / 3')).toBeTruthy();
  expect(create).toHaveBeenCalledTimes(1);
  expect(bootstrap).toHaveBeenCalledTimes(3);
});
it.each(['INVALID_SHEEP_COUNT', 'VALIDATION_ERROR'])(
  'keeps a definitive input rejection editable without starting a recovery query (%s)',
  async (code) => {
    const actions = createMockNightReentry('recorded'),
      bootstrap = jest.spyOn(actions, 'bootstrap');
    const create = jest
      .spyOn(actions, 'createSession')
      .mockRejectedValueOnce(new ApiError('http', { status: 422, code }));
    await startThree(actions);
    expect(screen.getByRole('alert')).toHaveTextContent(
      /양 수가 접수되지 않았어요/,
    );
    expect(screen.getByLabelText('선택한 양 수')).toHaveTextContent('3마리');
    expect(
      screen.queryByRole('button', { name: '밤 상태 다시 확인' }),
    ).toBeNull();
    expect(bootstrap).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole('radio', { name: '10마리' }));
    await press('양 세기 시작');
    await settle();
    expect(screen.getByText('1 / 10')).toBeTruthy();
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls.map((c) => c[1])).toEqual([3, 10]);
  },
);
it('waits for a no-active-session lookup before allowing a new explicit create and retains the selected count', async () => {
  const actions = createMockNightReentry('recorded'),
    bootstrap = jest.spyOn(actions, 'bootstrap');
  const create = jest
    .spyOn(actions, 'createSession')
    .mockRejectedValueOnce(new ApiError('network'));
  await startThree(actions);
  await press('밤 상태 다시 확인');
  await settle();
  expect(screen.getByLabelText('선택한 양 수')).toHaveTextContent('3마리');
  expect(create).toHaveBeenCalledTimes(1);
  expect(bootstrap).toHaveBeenCalledTimes(2);
  await press('양 세기 시작');
  await settle();
  expect(screen.getByText('1 / 3')).toBeTruthy();
  expect(create).toHaveBeenCalledTimes(2);
});
it('retries only the known session resume after recovery lookup has succeeded', async () => {
  const { actions, create, bootstrap, resume } = loseCreationReply(
    new ApiError('network'),
  );
  await startThree(actions);
  resume.mockRejectedValueOnce(new ApiError('network'));
  await press('밤 상태 다시 확인');
  await settle();
  await press('다시 시도');
  await settle();
  expect(screen.getByText('1 / 3')).toBeTruthy();
  expect(create).toHaveBeenCalledTimes(1);
  expect(bootstrap).toHaveBeenCalledTimes(2);
  expect(resume).toHaveBeenCalledTimes(2);
});
it('cancels a pending recovery lookup on back and ignores its late result', async () => {
  const { actions, create, bootstrap, resume } = loseCreationReply(
    new ApiError('network'),
  );
  await startThree(actions);
  let resolve!: (v: Awaited<ReturnType<typeof actions.bootstrap>>) => void;
  bootstrap.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  await press('밤 상태 다시 확인');
  expect(bootstrap).toHaveBeenCalledTimes(2);
  const signal = bootstrap.mock.calls[1][0];
  expect(
    screen.queryByRole('button', { name: '밤 상태 다시 확인' }),
  ).toBeNull();
  await press('재진입 나가기');
  expect(signal.aborted).toBe(true);
  await act(async () =>
    resolve({
      phase: 'night',
      next_screen: 'NIGHT_FEED',
      night_id: 'reentry-night',
      active_session_id: 'reentry-session-1',
      support: null,
    }),
  );
  expect(screen.queryByText('1 / 3')).toBeNull();
  expect(create).toHaveBeenCalledTimes(1);
  expect(resume).not.toHaveBeenCalled();
  expect(
    screen.getByRole('button', { name: '밤 상태 다시 확인' }),
  ).toBeTruthy();
});
it('leaves creation recovery when the confirmed route has moved to a day screen', async () => {
  const { actions, create, bootstrap } = loseCreationReply(
    new ApiError('network'),
  );
  await startThree(actions);
  bootstrap.mockResolvedValueOnce({
    phase: 'day',
    next_screen: 'HOME',
    night_id: 'reentry-night',
    active_session_id: null,
    support: null,
  });
  await press('밤 상태 다시 확인');
  await settle();
  expect(screen.getByText('지금은 이 밤을 이어 볼 수 없어요')).toBeTruthy();
  expect(screen.getByRole('button', { name: '시연 끝내기' })).toBeTruthy();
  expect(
    screen.queryByRole('button', { name: '밤 상태 다시 확인' }),
  ).toBeNull();
  expect(create).toHaveBeenCalledTimes(1);
});

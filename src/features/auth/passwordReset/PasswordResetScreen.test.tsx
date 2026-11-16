import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { StrictMode } from 'react';
import { ApiError } from '../../../api/errors';
import { deferred } from '../../../notifications/__tests__/fakeDevice';
import type { PasswordResetActions } from './model';
import { PasswordResetScreen } from './PasswordResetScreen';
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
const write = (email = ' User@Example.COM ') =>
  fireEvent.changeText(screen.getByLabelText('이메일 주소'), email);
let states: Set<(state: AppStateStatus) => void>;
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-11-17T00:00:00Z'));
  states = new Set();
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, callback) => {
      states.add(callback);
      return {
        remove: () => {
          states.delete(callback);
        },
      };
    });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
function actions() {
  return {
    request: jest
      .fn<PasswordResetActions['request']>()
      .mockResolvedValue({ accepted: true }),
  };
}
it('validates an empty and malformed address before submitting', async () => {
  const api = actions();
  await render(<PasswordResetScreen actions={api} onLogin={() => {}} />);
  await press('재설정 메일 보내기');
  expect(
    screen.getAllByText('이메일 주소를 입력해 주세요.').length,
  ).toBeGreaterThan(0);
  await write('not-email');
  await press('재설정 메일 보내기');
  expect(
    screen.getAllByText('이메일 주소를 확인해 주세요.').length,
  ).toBeGreaterThan(0);
  expect(api.request).not.toHaveBeenCalled();
});
it('normalizes email, ignores account-specific response fields and returns only email to login', async () => {
  const api = actions(),
    onLogin = jest.fn();
  api.request.mockResolvedValue({
    accepted: true,
    registered: false,
    private_detail: 'private-account',
  });
  await render(<PasswordResetScreen actions={api} onLogin={onLogin} />);
  await write();
  await press('재설정 메일 보내기');
  expect(api.request).toHaveBeenCalledWith(
    'user@example.com',
    expect.any(AbortSignal),
  );
  expect(screen.getByRole('header', { name: '메일을 보냈어요' })).toBeTruthy();
  expect(screen.getByText(/user@example.com이 가입된 주소라면/)).toBeTruthy();
  expect(screen.queryByText('private-account')).toBeNull();
  await press('로그인으로 돌아가기');
  expect(onLogin).toHaveBeenCalledWith(' User@Example.COM ');
});
it('keeps the draft and safely retries an uncertain network response', async () => {
  const api = actions();
  api.request.mockRejectedValueOnce(
    new ApiError('network', { serverMessage: 'private-error' }),
  );
  await render(<PasswordResetScreen actions={api} onLogin={() => {}} />);
  await write();
  await press('재설정 메일 보내기');
  expect(screen.getByLabelText('이메일 주소')).toHaveDisplayValue(
    ' User@Example.COM ',
  );
  expect(screen.queryByText('private-error')).toBeNull();
  expect(api.request).toHaveBeenCalledTimes(1);
  await press('재설정 메일 보내기');
  expect(api.request).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('header', { name: '메일을 보냈어요' })).toBeTruthy();
});
it.each([null, { accepted: false }])(
  'does not show a success screen for an invalid receipt %j',
  async (result) => {
    const api = actions();
    api.request.mockResolvedValue(result);
    await render(<PasswordResetScreen actions={api} onLogin={() => {}} />);
    await write();
    await press('재설정 메일 보내기');
    expect(
      screen.queryByRole('header', { name: '메일을 보냈어요' }),
    ).toBeNull();
    expect(
      screen.getByText('요청을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.'),
    ).toBeTruthy();
  },
);
it('locks duplicate button and keyboard submissions while preserving an abortable pending request', async () => {
  const api = actions(),
    wait = deferred<unknown>();
  api.request.mockImplementation(() => wait.promise);
  const view = await render(
    <PasswordResetScreen actions={api} onLogin={() => {}} />,
  );
  await write();
  await press('재설정 메일 보내기');
  expect(screen.getByRole('button', { name: '메일 요청 중' })).toBeDisabled();
  await press('메일 요청 중');
  await fireEvent(screen.getByLabelText('이메일 주소'), 'submitEditing');
  expect(api.request).toHaveBeenCalledTimes(1);
  await view.unmount();
  expect(api.request.mock.calls[0][1].aborted).toBe(true);
  await act(async () => wait.resolve({ accepted: true }));
});
it('blocks a relative Retry-After and never automatically resends on expiry', async () => {
  const api = actions();
  api.request.mockRejectedValueOnce(
    new ApiError('http', { status: 429, retryAfter: '3' }),
  );
  await render(<PasswordResetScreen actions={api} onLogin={() => {}} />);
  await write();
  await press('재설정 메일 보내기');
  expect(
    screen.getByRole('button', { name: '3초 후 다시 보내기' }),
  ).toBeDisabled();
  await act(async () => {
    await jest.advanceTimersByTimeAsync(2000);
  });
  expect(
    screen.getByRole('button', { name: '1초 후 다시 보내기' }),
  ).toBeDisabled();
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1000);
  });
  expect(api.request).toHaveBeenCalledTimes(1);
  expect(
    screen.getByRole('button', { name: '재설정 메일 보내기' }),
  ).toBeEnabled();
  await press('재설정 메일 보내기');
  expect(screen.getByRole('header', { name: '메일을 보냈어요' })).toBeTruthy();
});
it.each([undefined, '2099 GMT', 'Tue, 31 Nov 2026 00:00:00 GMT'])(
  'does not invent a lock for malformed Retry-After %s',
  async (retryAfter) => {
    const api = actions();
    api.request.mockRejectedValueOnce(
      new ApiError('http', { status: 429, retryAfter }),
    );
    await render(<PasswordResetScreen actions={api} onLogin={() => {}} />);
    await write();
    await press('재설정 메일 보내기');
    expect(
      screen.getByText('요청이 많아요. 잠시 후 다시 시도해 주세요.'),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: '재설정 메일 보내기' }),
    ).toBeEnabled();
    expect(api.request).toHaveBeenCalledTimes(1);
    await press('재설정 메일 보내기');
    expect(
      screen.getByRole('header', { name: '메일을 보냈어요' }),
    ).toBeTruthy();
  },
);
it('keeps a resend date limit when returning to the form and refreshes it on foreground', async () => {
  const intervals = jest.spyOn(globalThis, 'setInterval');
  const clear = jest.spyOn(globalThis, 'clearInterval');
  const api = actions();
  api.request.mockResolvedValueOnce({ accepted: true }).mockRejectedValueOnce(
    new ApiError('http', {
      status: 429,
      retryAfter: new Date(Date.now() + 5000).toUTCString(),
    }),
  );
  const view = await render(
    <PasswordResetScreen actions={api} onLogin={() => {}} />,
  );
  await write();
  await press('재설정 메일 보내기');
  await press('메일 다시 보내기');
  expect(
    screen.getByRole('button', { name: '5초 후 다시 보내기' }),
  ).toBeDisabled();
  await press('뒤로');
  expect(screen.getByLabelText('이메일 주소')).toHaveDisplayValue(
    ' User@Example.COM ',
  );
  expect(
    screen.getByRole('button', { name: '5초 후 다시 보내기' }),
  ).toBeDisabled();
  await act(async () => {
    jest.setSystemTime(new Date(Date.now() + 10000));
    for (const cb of states) cb('active');
  });
  expect(
    screen.getByRole('button', { name: '재설정 메일 보내기' }),
  ).toBeEnabled();
  expect(api.request).toHaveBeenCalledTimes(2);
  await view.unmount();
  expect(states.size).toBe(0);
  const cooldown = intervals.mock.calls.findIndex((call) => call[1] === 1000);
  expect(cooldown).toBeGreaterThanOrEqual(0);
  expect(
    clear.mock.calls.some(([timer]) =>
      Object.is(timer, intervals.mock.results[cooldown].value),
    ),
  ).toBe(true);
});
it('can request after StrictMode replays its setup and cleanup', async () => {
  const api = actions();
  await render(
    <StrictMode>
      <PasswordResetScreen actions={api} onLogin={() => {}} />
    </StrictMode>,
  );
  await write();
  await press('재설정 메일 보내기');
  expect(api.request).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('header', { name: '메일을 보냈어요' })).toBeTruthy();
});
it.each(['success', 'failure'] as const)(
  'aborts an old source and ignores its late %s',
  async (outcome) => {
    const old = actions(),
      next = actions(),
      wait = deferred<unknown>();
    old.request.mockImplementation(() => wait.promise);
    const view = await render(
      <PasswordResetScreen actions={old} onLogin={() => {}} />,
    );
    await write();
    await press('재설정 메일 보내기');
    await view.rerender(
      <PasswordResetScreen actions={next} onLogin={() => {}} />,
    );
    expect(old.request.mock.calls[0][1].aborted).toBe(true);
    await act(async () => {
      if (outcome === 'success') wait.resolve({ accepted: true });
      else wait.reject(new Error('old-failure'));
    });
    expect(screen.getByLabelText('이메일 주소')).toHaveDisplayValue('');
    expect(
      screen.queryByRole('header', { name: '메일을 보냈어요' }),
    ).toBeNull();
    expect(
      screen.queryByText(
        '요청을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.',
      ),
    ).toBeNull();
  },
);
it('cancels an in-progress resend when returning to login and ignores its result', async () => {
  const api = actions(),
    wait = deferred<unknown>(),
    onLogin = jest.fn();
  api.request
    .mockResolvedValueOnce({ accepted: true })
    .mockImplementation(() => wait.promise);
  await render(<PasswordResetScreen actions={api} onLogin={onLogin} />);
  await write();
  await press('재설정 메일 보내기');
  await press('메일 다시 보내기');
  expect(
    screen.getByRole('button', { name: '메일 다시 요청 중' }),
  ).toBeDisabled();
  await press('로그인으로 돌아가기');
  expect(api.request.mock.calls[1][1].aborted).toBe(true);
  expect(onLogin).toHaveBeenCalledTimes(1);
  await act(async () => wait.resolve({ accepted: true }));
  expect(onLogin).toHaveBeenCalledTimes(1);
});

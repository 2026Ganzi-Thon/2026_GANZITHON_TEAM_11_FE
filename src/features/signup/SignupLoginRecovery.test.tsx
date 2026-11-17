import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import { SignupFlow } from './SignupFlow';
import { createMockSignup } from '../../mocks/signup';
import type { PasswordResetActions } from '../auth/passwordReset/model';
import { deferred } from '../../notifications/__tests__/fakeDevice';
const tick = () =>
  act(async () => {
    await jest.runAllTimersAsync();
  });
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
let handlers: Set<() => boolean | null | undefined>;
beforeEach(() => {
  jest.useFakeTimers();
  handlers = new Set();
  jest
    .spyOn(BackHandler, 'addEventListener')
    .mockImplementation((_event, callback) => {
      const handle = () => callback({} as Parameters<typeof callback>[0]);
      handlers.add(handle);
      return {
        remove: () => {
          handlers.delete(handle);
        },
      };
    });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
async function back(mode: 'screen' | 'hardware') {
  if (mode === 'screen') await press('뒤로');
  else
    await act(async () => {
      for (const h of [...handlers].reverse()) if (h()) break;
    });
}
async function open(actions = createMockSignup()) {
  const exit = jest.fn();
  await render(<SignupFlow actions={actions} onExit={exit} />);
  await press('이메일로 로그인');
  await fireEvent.changeText(
    screen.getByLabelText('이메일 주소'),
    'User@Example.com',
  );
  await fireEvent.changeText(
    screen.getByLabelText('비밀번호'),
    'secret-password',
  );
  await press('비밀번호를 잊었어요');
  return exit;
}
it('connects onboarding login to the shared reset action, resend and email-only login return', async () => {
  const actions = createMockSignup(),
    request = jest.spyOn(actions.passwordReset, 'request');
  await open(actions);
  expect(screen.getByLabelText('이메일 주소')).toHaveDisplayValue(
    'User@Example.com',
  );
  expect(screen.queryByLabelText('비밀번호')).toBeNull();
  await press('재설정 메일 보내기');
  await tick();
  expect(screen.getByText('메일을 보냈어요')).toBeTruthy();
  expect(request).toHaveBeenLastCalledWith(
    'user@example.com',
    expect.any(AbortSignal),
  );
  await press('메일 다시 보내기');
  await tick();
  expect(request).toHaveBeenCalledTimes(2);
  await press('로그인으로 돌아가기');
  expect(screen.getByLabelText('이메일 주소')).toHaveDisplayValue(
    'User@Example.com',
  );
  expect(screen.getByLabelText('비밀번호')).toHaveDisplayValue('');
  await back('screen');
  expect(
    screen.getByRole('button', { name: '이메일로 회원가입' }),
  ).toBeTruthy();
});
it.each([
  ['screen', 'success'],
  ['screen', 'failure'],
  ['hardware', 'success'],
  ['hardware', 'failure'],
] as const)(
  'cancels recovery on %s back and ignores a late %s without skipping login or welcome',
  async (mode, outcome) => {
    const wait = deferred<unknown>(),
      request = jest
        .fn<PasswordResetActions['request']>()
        .mockImplementation(() => wait.promise),
      actions = { ...createMockSignup(), passwordReset: { request } };
    const exit = await open(actions);
    await press('재설정 메일 보내기');
    await back(mode);
    expect(request.mock.calls[0][1].aborted).toBe(true);
    expect(screen.getByLabelText('비밀번호')).toHaveDisplayValue('');
    expect(screen.getByLabelText('이메일 주소')).toHaveDisplayValue(
      'User@Example.com',
    );
    expect(exit).not.toHaveBeenCalled();
    await act(async () => {
      if (outcome === 'success') wait.resolve({ accepted: true });
      else wait.reject(new Error('late'));
    });
    expect(screen.queryByText('메일을 보냈어요')).toBeNull();
    await back(mode);
    expect(
      screen.getByRole('button', { name: '이메일로 회원가입' }),
    ).toBeTruthy();
    expect(exit).not.toHaveBeenCalled();
    await back('hardware');
    expect(exit).toHaveBeenCalledTimes(1);
  },
);
it.each(['screen', 'hardware'] as const)(
  'returns from a pending resend to the request form on %s back and then to login',
  async (mode) => {
    const wait = deferred<unknown>(),
      request = jest
        .fn<PasswordResetActions['request']>()
        .mockResolvedValueOnce({ accepted: true })
        .mockImplementationOnce(() => wait.promise);
    await open({ ...createMockSignup(), passwordReset: { request } });
    await press('재설정 메일 보내기');
    await tick();
    await press('메일 다시 보내기');
    await back(mode);
    expect(request.mock.calls[1][1].aborted).toBe(true);
    expect(
      screen.getByRole('header', { name: '비밀번호를 잊었나요?' }),
    ).toBeTruthy();
    expect(screen.queryByLabelText('비밀번호')).toBeNull();
    await act(async () => wait.resolve({ accepted: true }));
    expect(screen.queryByText('메일을 보냈어요')).toBeNull();
    await back(mode);
    expect(screen.getByLabelText('비밀번호')).toHaveDisplayValue('');
    expect(screen.getByLabelText('이메일 주소')).toHaveDisplayValue(
      'User@Example.com',
    );
  },
);

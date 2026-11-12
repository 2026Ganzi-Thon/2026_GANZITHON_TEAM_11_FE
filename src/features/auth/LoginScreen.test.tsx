import { describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ApiError } from '../../api/errors';
import { LoginScreen, type LoginSubmit } from './LoginScreen';

async function fill(email = ' User@Example.com ', password = ' pass word ') {
  await fireEvent.changeText(screen.getByLabelText('이메일 주소'), email);
  await fireEvent.changeText(screen.getByLabelText('비밀번호'), password);
}

describe('login form', () => {
  it('does not submit missing or malformed input', async () => {
    const submit = jest.fn<LoginSubmit>();
    await render(<LoginScreen submit={submit} onBack={() => {}} />);
    await fireEvent.press(screen.getByRole('button', { name: '로그인' }));
    expect(screen.getByText('이메일 주소를 입력해 주세요.')).toBeTruthy();
    expect(screen.getByText('비밀번호를 입력해 주세요.')).toBeTruthy();
    await fill('invalid', 'x');
    await fireEvent.press(screen.getByRole('button', { name: '로그인' }));
    expect(screen.getByText('이메일 주소를 확인해 주세요.')).toBeTruthy();
    expect(submit).not.toHaveBeenCalled();
  });

  it('normalizes email, preserves password, and clears the password after mock success', async () => {
    const submit = jest.fn<LoginSubmit>().mockResolvedValue(undefined);
    await render(<LoginScreen submit={submit} onBack={() => {}} />);
    await fill();
    expect(screen.getByLabelText('비밀번호').props.secureTextEntry).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: '로그인' }));
    expect(submit).toHaveBeenCalledWith(
      { email: 'user@example.com', password: ' pass word ' },
      expect.any(AbortSignal),
    );
    expect(screen.getByText('화면 확인이 완료됐어요')).toBeTruthy();
    expect(screen.getByLabelText('비밀번호').props.value).toBe('');
  });

  it('blocks duplicate submissions from both the button and keyboard', async () => {
    let finish!: () => void;
    const submit = jest.fn<LoginSubmit>().mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await render(<LoginScreen submit={submit} onBack={() => {}} />);
    await fill();
    await fireEvent.press(screen.getByRole('button', { name: '로그인' }));
    expect(
      screen.getByRole('button', { name: '확인 중' }).props.accessibilityState
        .busy,
    ).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: '확인 중' }));
    await fireEvent(screen.getByLabelText('비밀번호'), 'submitEditing');
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => finish());
  });

  it.each([
    [
      new ApiError('http', { status: 401, serverMessage: 'private-detail' }),
      '이메일 또는 비밀번호를 확인해 주세요.',
    ],
    [new ApiError('network'), '연결하지 못했어요. 잠시 후 다시 시도해 주세요.'],
    [new ApiError('timeout'), '응답이 늦어지고 있어요. 다시 시도해 주세요.'],
  ] as const)(
    'shows a safe failure message and allows retry: %s',
    async (error, message) => {
      const submit = jest
        .fn<LoginSubmit>()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(undefined);
      await render(<LoginScreen submit={submit} onBack={() => {}} />);
      await fill();
      await fireEvent.press(screen.getByRole('button', { name: '로그인' }));
      expect(screen.getByText(message)).toBeTruthy();
      expect(screen.queryByText('private-detail')).toBeNull();
      await fireEvent.press(screen.getByRole('button', { name: '다시 시도' }));
      expect(submit).toHaveBeenCalledTimes(2);
      expect(screen.getByText('화면 확인이 완료됐어요')).toBeTruthy();
    },
  );

  it('aborts the pending operation on unmount and ignores a late success', async () => {
    let finish!: () => void;
    const submit = jest.fn<LoginSubmit>().mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await render(<LoginScreen submit={submit} onBack={() => {}} />);
    await fill();
    await fireEvent.press(screen.getByRole('button', { name: '로그인' }));
    const signal = submit.mock.calls[0][1];
    await screen.unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => finish());
  });

  it('explains the unconnected password reset action and supports going back', async () => {
    const onBack = jest.fn();
    await render(
      <LoginScreen submit={jest.fn<LoginSubmit>()} onBack={onBack} />,
    );
    await fireEvent.press(
      screen.getByRole('button', { name: '비밀번호를 잊었어요' }),
    );
    expect(screen.getByText('비밀번호 찾기는 준비 중이에요.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '뒤로' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

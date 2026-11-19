import { expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { LoginRecoveryFlow } from './LoginRecoveryFlow';
import type { LoginSubmit } from './LoginScreen';
import type { PasswordResetActions } from './passwordReset/model';
import { deferred } from '../../notifications/__tests__/fakeDevice';
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
it('keeps email through recovery and clears password before returning to login', async () => {
  const request = jest
    .fn<PasswordResetActions['request']>()
    .mockResolvedValue({ accepted: true });
  await render(
    <LoginRecoveryFlow
      submit={jest.fn<LoginSubmit>()}
      resetActions={{ request }}
      onExit={() => {}}
    />,
  );
  await fireEvent.changeText(
    screen.getByLabelText('이메일 주소'),
    'User@Example.com',
  );
  await fireEvent.changeText(screen.getByLabelText('비밀번호'), 'secret');
  await press('비밀번호를 잊었어요');
  expect(screen.queryByLabelText('비밀번호')).toBeNull();
  expect(screen.getByLabelText('이메일 주소')).toHaveDisplayValue(
    'User@Example.com',
  );
  await press('재설정 메일 보내기');
  await press('로그인으로 돌아가기');
  expect(screen.getByLabelText('이메일 주소')).toHaveDisplayValue(
    'User@Example.com',
  );
  expect(screen.getByLabelText('비밀번호')).toHaveDisplayValue('');
});
it('aborts a pending login before entering recovery and ignores its late completion', async () => {
  const wait = deferred<void>(),
    submit = jest.fn<LoginSubmit>().mockImplementation(() => wait.promise);
  await render(
    <LoginRecoveryFlow
      submit={submit}
      resetActions={{ request: async () => ({ accepted: true }) }}
      onExit={() => {}}
    />,
  );
  await fireEvent.changeText(
    screen.getByLabelText('이메일 주소'),
    'test@example.com',
  );
  await fireEvent.changeText(screen.getByLabelText('비밀번호'), 'secret');
  await press('로그인');
  await press('비밀번호를 잊었어요');
  expect(submit.mock.calls[0][1].aborted).toBe(true);
  await act(async () => wait.resolve());
  expect(
    screen.getByRole('header', { name: '비밀번호를 잊었나요?' }),
  ).toBeTruthy();
  expect(screen.queryByText('화면 확인이 완료됐어요')).toBeNull();
});
it('notifies its host only after a confirmed uncancelled login', async () => {
  const wait = deferred<void>(),
    done = jest.fn();
  await render(
    <LoginRecoveryFlow
      submit={() => wait.promise}
      resetActions={{ request: async () => ({ accepted: true }) }}
      onExit={() => {}}
      onSuccess={done}
    />,
  );
  await fireEvent.changeText(
    screen.getByLabelText('이메일 주소'),
    'user@example.com',
  );
  await fireEvent.changeText(screen.getByLabelText('비밀번호'), 'password');
  await press('로그인');
  expect(done).not.toHaveBeenCalled();
  await act(async () => wait.resolve());
  expect(done).toHaveBeenCalledTimes(1);
});
it('does not route a cancelled login to the home when its response arrives late', async () => {
  const wait = deferred<void>(),
    done = jest.fn();
  await render(
    <LoginRecoveryFlow
      submit={() => wait.promise}
      resetActions={{ request: async () => ({ accepted: true }) }}
      onExit={() => {}}
      onSuccess={done}
    />,
  );
  await fireEvent.changeText(
    screen.getByLabelText('이메일 주소'),
    'user@example.com',
  );
  await fireEvent.changeText(screen.getByLabelText('비밀번호'), 'password');
  await press('로그인');
  await press('비밀번호를 잊었어요');
  await act(async () => wait.resolve());
  expect(done).not.toHaveBeenCalled();
  expect(
    screen.getByRole('header', { name: '비밀번호를 잊었나요?' }),
  ).toBeTruthy();
});

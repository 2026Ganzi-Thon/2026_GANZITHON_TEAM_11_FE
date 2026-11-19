import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SignupFlow } from './SignupFlow';
import { createMockSignup } from '../../mocks/signup';
const tick = () =>
  act(async () => {
    await jest.runAllTimersAsync();
  });
const press = (label: string) =>
  fireEvent.press(screen.getByRole('button', { name: label }));
async function email() {
  await press('이메일로 회원가입');
  await fireEvent.changeText(
    screen.getByLabelText('이메일 주소'),
    'TEST@EXAMPLE.COM',
  );
  await fireEvent.changeText(screen.getByLabelText('비밀번호'), 'password');
  await fireEvent.changeText(
    screen.getByLabelText('비밀번호 확인'),
    'password',
  );
  await press('다음');
  await tick();
}
async function agree() {
  for (const label of [
    '[필수] 서비스 이용약관',
    '[필수] 개인정보·입력정보 처리 안내',
  ])
    await fireEvent.press(screen.getByRole('checkbox', { name: label }));
  await press('동의하고 계속');
  await tick();
}
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});
it('connects signup, document view, required consent and initial birth save without requesting notification consent', async () => {
  const actions = createMockSignup(),
    registered = jest.spyOn(actions, 'register');
  await render(<SignupFlow actions={actions} onExit={() => {}} />);
  await email();
  expect(screen.getByRole('button', { name: '동의하고 계속' })).toBeDisabled();
  await press('서비스 이용약관 보기');
  expect(screen.getByText(/시행일은 확정 전입니다/)).toBeTruthy();
  await press('문서 닫기');
  await agree();
  expect(screen.getByText('생일을 알려 주세요')).toBeTruthy();
  await fireEvent(
    screen.getByRole('adjustable', { name: '출생 월' }),
    'accessibilityAction',
    { nativeEvent: { actionName: 'increment' } },
  );
  await press('이전 단계');
  await press('이전 단계');
  expect(screen.getByLabelText('이메일 주소')).toHaveDisplayValue(
    'test@example.com',
  );
  expect(screen.getByLabelText('비밀번호')).toHaveDisplayValue('');
  await press('계속');
  await press('동의하고 계속');
  await tick();
  expect(
    screen.getByRole('adjustable', { name: '출생 월' }),
  ).toHaveAccessibilityValue({ now: 6 });
  await press('다음');
  await tick();
  expect(screen.getByText('가입 정보 확인을 마쳤어요')).toBeTruthy();
  expect(registered).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/한 번 수정/)).toBeTruthy();
});
it('restores editable input on back and recovers a lost registration before proceeding', async () => {
  const actions = createMockSignup('register-lost'),
    register = jest.spyOn(actions, 'register');
  await render(<SignupFlow actions={actions} onExit={() => {}} />);
  await press('이메일로 회원가입');
  await fireEvent.changeText(
    screen.getByLabelText('이메일 주소'),
    'a@example.com',
  );
  await press('이전 단계');
  await press('이메일로 회원가입');
  expect(screen.getByLabelText('이메일 주소')).toHaveDisplayValue(
    'a@example.com',
  );
  await fireEvent.changeText(screen.getByLabelText('비밀번호'), 'password');
  await fireEvent.changeText(
    screen.getByLabelText('비밀번호 확인'),
    'password',
  );
  await press('다음');
  await tick();
  expect(screen.getByLabelText('이메일 주소').props.editable).toBe(false);
  await press('가입 결과 다시 확인');
  await tick();
  expect(screen.getByRole('button', { name: '동의하고 계속' })).toBeTruthy();
  expect(register.mock.calls[0][0]).toBe(register.mock.calls[1][0]);
});
it('blocks agreement when documents fail and recovers with unchecked required choices', async () => {
  await render(
    <SignupFlow
      actions={createMockSignup('documents-retry')}
      onExit={() => {}}
    />,
  );
  await email();
  expect(screen.getByRole('button', { name: '동의하고 계속' })).toBeDisabled();
  await press('동의 문서 다시 불러오기');
  await tick();
  expect(
    screen.getByRole('checkbox', { name: '[필수] 서비스 이용약관' }),
  ).not.toBeChecked();
});
it('replaces the source, aborts in-flight work and ignores its late completion', async () => {
  const old = createMockSignup();
  let finish!: (v: { id: string; email: string }) => void;
  const register = jest.spyOn(old, 'register').mockImplementation(
    () =>
      new Promise((r) => {
        finish = r;
      }),
  );
  await render(<SignupFlow actions={old} onExit={() => {}} />);
  await email();
  expect(screen.getByRole('button', { name: '확인 중' })).toBeDisabled();
  await screen.rerender(
    <SignupFlow actions={createMockSignup()} onExit={() => {}} />,
  );
  expect(register.mock.calls[0][2].aborted).toBe(true);
  await act(async () => finish({ id: 'old', email: 'test@example.com' }));
  expect(
    screen.getByRole('button', { name: '이메일로 회원가입' }),
  ).toBeTruthy();
  expect(screen.queryByRole('button', { name: '동의하고 계속' })).toBeNull();
});
it('retains the date on save failure and shows a successful retry without consuming an edit', async () => {
  await render(
    <SignupFlow actions={createMockSignup('birth-retry')} onExit={() => {}} />,
  );
  await email();
  await agree();
  await press('다음');
  await tick();
  expect(screen.getByRole('alert')).toBeTruthy();
  await press('생일 저장 결과 다시 확인');
  await tick();
  expect(screen.getByText('가입 정보 확인을 마쳤어요')).toBeTruthy();
});
it('keeps all validation errors together beside the submit action without sending registration', async () => {
  const actions = createMockSignup(),
    register = jest.spyOn(actions, 'register');
  await render(<SignupFlow actions={actions} onExit={() => {}} />);
  await press('이메일로 회원가입');
  await press('다음');
  expect(
    screen
      .getAllByRole('alert')
      .some(
        (node) =>
          node.props.children ===
          '이메일 주소를 확인해 주세요.\n비밀번호는 8~128자로 입력해 주세요.\n비밀번호가 일치하지 않아요.',
      ),
  ).toBe(true);
  expect(register).not.toHaveBeenCalled();
});
it.each(['register-in-progress', 'birth-in-progress'] as const)(
  'recovers the existing %s result through the actual mock adapter',
  async (scenario) => {
    const actions = createMockSignup(scenario),
      register = jest.spyOn(actions, 'register'),
      birth = jest.spyOn(actions, 'birth');
    await render(<SignupFlow actions={actions} onExit={() => {}} />);
    await email();
    if (scenario === 'register-in-progress') {
      expect(screen.getByLabelText('이메일 주소').props.editable).toBe(false);
      expect(
        screen.getByRole('button', { name: '가입 결과 다시 확인' }),
      ).toBeTruthy();
      await press('가입 결과 다시 확인');
      await tick();
      expect(register.mock.calls[1].slice(0, 2)).toEqual(
        register.mock.calls[0].slice(0, 2),
      );
    }
    await agree();
    await press('다음');
    await tick();
    if (scenario === 'birth-in-progress') {
      expect(
        screen.getByRole('adjustable', { name: '출생 월' }),
      ).toBeDisabled();
      await fireEvent(
        screen.getByRole('adjustable', { name: '출생 월' }),
        'accessibilityAction',
        { nativeEvent: { actionName: 'increment' } },
      );
      await press('생일 저장 결과 다시 확인');
      await tick();
      expect(birth.mock.calls.map((call) => call[1])).toEqual([
        '2004-05-14',
        '2004-05-14',
      ]);
    }
    expect(screen.getByText('가입 정보 확인을 마쳤어요')).toBeTruthy();
    expect(register).toHaveBeenCalledTimes(
      scenario === 'register-in-progress' ? 2 : 1,
    );
    expect(birth).toHaveBeenCalledTimes(
      scenario === 'birth-in-progress' ? 2 : 1,
    );
  },
);
it('keeps all consent selections while reading and closing the shared document dialog', async () => {
  await render(<SignupFlow actions={createMockSignup()} onExit={() => {}} />);
  await email();
  const label = '[필수] 서비스 이용약관';
  await fireEvent.press(screen.getByRole('checkbox', { name: label }));
  await press('서비스 이용약관 보기');
  await fireEvent(screen.getByTestId('legal-document-modal'), 'requestClose');
  expect(screen.getByRole('checkbox', { name: label })).toBeChecked();
  expect(
    screen.getByRole('checkbox', {
      name: '[필수] 개인정보·입력정보 처리 안내',
    }),
  ).not.toBeChecked();
  expect(screen.getByRole('button', { name: '동의하고 계속' })).toBeDisabled();
});

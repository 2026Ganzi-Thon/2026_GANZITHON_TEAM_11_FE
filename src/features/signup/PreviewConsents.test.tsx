import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SignupFlow } from './SignupFlow';
import { createMockSignup } from '../../mocks/signup';
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
const check = (name: string) =>
  fireEvent.press(screen.getByRole('checkbox', { name }));
async function tick() {
  await act(async () => {
    await jest.runAllTimersAsync();
  });
}
async function open(
  scenario: Parameters<typeof createMockSignup>[0] = 'success',
) {
  jest.useFakeTimers();
  const actions = createMockSignup(scenario),
    consent = jest.spyOn(actions, 'consent');
  await render(<SignupFlow actions={actions} onExit={() => {}} />);
  await press('이메일로 회원가입');
  await fireEvent.changeText(
    screen.getByLabelText('이메일 주소'),
    'trial@example.com',
  );
  await fireEvent.changeText(screen.getByLabelText('비밀번호'), 'password');
  await fireEvent.changeText(
    screen.getByLabelText('비밀번호 확인'),
    'password',
  );
  await press('다음');
  await tick();
  return { actions, consent };
}
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});
it('keeps AI as a read-only notice and accepts the two required choices without notification consent', async () => {
  const { consent } = await open();
  expect(screen.queryByRole('checkbox', { name: /AI/ })).toBeNull();
  expect(screen.getByRole('button', { name: '동의하고 계속' })).toBeDisabled();
  await check('[필수] 서비스 이용약관');
  await press('외부 AI 사용 여부 안내 보기');
  expect(
    screen.getByRole('header', { name: '외부 AI 사용 여부 안내' }),
  ).toBeTruthy();
  await press('문서 닫기');
  expect(
    screen.getByRole('checkbox', {
      name: '[필수] 개인정보·입력정보 처리 안내',
    }),
  ).not.toBeChecked();
  await check('[필수] 개인정보·입력정보 처리 안내');
  expect(screen.getByRole('button', { name: '동의하고 계속' })).toBeEnabled();
  await check('전체 동의');
  expect(
    screen.getByRole('checkbox', { name: '[선택] 알림 수신' }),
  ).toBeChecked();
  await check('[선택] 알림 수신');
  await press('동의하고 계속');
  await tick();
  expect(consent).toHaveBeenCalledWith(
    expect.any(String),
    {
      revision: expect.any(String),
      choices: { terms: true, privacy: true, notifications: false },
    },
    expect.any(AbortSignal),
  );
  expect(screen.getByRole('adjustable', { name: '출생 월' })).toBeTruthy();
});
it('requires renewed required choices after a document revision changes without adding an AI permission', async () => {
  const { actions, consent } = await open('version-changed');
  await check('전체 동의');
  await press('동의하고 계속');
  await tick();
  expect(screen.getByText(/새 내용을 확인하고 다시 선택/)).toBeTruthy();
  await tick();
  expect(
    screen.getByRole('checkbox', { name: '[필수] 서비스 이용약관' }),
  ).not.toBeChecked();
  expect(
    screen.getByRole('checkbox', {
      name: '[필수] 개인정보·입력정보 처리 안내',
    }),
  ).not.toBeChecked();
  expect(screen.getByRole('button', { name: '동의하고 계속' })).toBeDisabled();
  expect(screen.queryByRole('checkbox', { name: /AI/ })).toBeNull();
  const docs = actions.loadDocuments(new AbortController().signal);
  await tick();
  const current = await docs;
  await check('[필수] 서비스 이용약관');
  await check('[필수] 개인정보·입력정보 처리 안내');
  await press('동의하고 계속');
  await tick();
  expect(consent.mock.calls.at(-1)?.[1]).toEqual({
    revision: current.revision,
    choices: { terms: true, privacy: true, notifications: false },
  });
});

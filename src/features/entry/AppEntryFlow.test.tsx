import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { AppEntryFlow } from './AppEntryFlow';
import { createMockSignupJourney } from '../../mocks/signupJourney';
import { createMockReminder } from '../../mocks/reminder';
import { createReminderConnection } from '../../notifications/connection';
import { createDeviceReminder } from '../../notifications/service';
import { storedDevice } from '../../notifications/__tests__/storedDevice';
import { getMockAppSession } from '../../mocks/appSession';
import { getNativeReminderSession } from '../../notifications/nativeRuntime';
jest.mock('../../notifications/nativeRuntime', () => ({
  getNativeReminderSession: jest.fn(),
}));
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
const tick = () =>
  act(async () => {
    return jest.advanceTimersByTimeAsync(3000);
  });
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});
function fixture(time = '2026-11-19T14:00:00+09:00') {
  const a = createMockReminder();
  return createMockSignupJourney(
    {
      ...a,
      ...createReminderConnection(a, createDeviceReminder(storedDevice().port)),
    },
    'day',
    { startAt: Date.parse(time) },
  );
}
const ui = (source: ReturnType<typeof fixture>, load = () => source) => (
  <SafeAreaInsetsContext.Provider
    value={{ top: 28, bottom: 24, left: 0, right: 0 }}
  >
    <AppEntryFlow loadSource={load} onExit={() => {}} onTools={() => {}} />
  </SafeAreaInsetsContext.Provider>
);
async function login() {
  await press('체험 시작');
  await press('이메일로 로그인');
  await fireEvent.changeText(
    screen.getByLabelText('이메일 주소'),
    'MEMBER@EXAMPLE.COM',
  );
  await fireEvent.changeText(screen.getByLabelText('비밀번호'), 'password');
  await press('로그인');
  await tick();
  await tick();
}
it.each([
  ['2026-11-19T14:00:00+09:00', false],
  ['2026-11-19T21:00:00+09:00', true],
] as const)(
  'connects mock login directly to the home at %s without signup choices',
  async (time, night) => {
    const source = fixture(time),
      load = jest.fn(() => source);
    await render(ui(source, load));
    expect(load).not.toHaveBeenCalled();
    expect(screen.queryByText('이메일로 회원가입')).toBeNull();
    await login();
    expect(load).toHaveBeenCalledTimes(1);
    expect(screen.getByText('아직 센 양이 없어요')).toBeTruthy();
    const button = screen.getByRole('button', {
      name: night ? '오늘 밤 양 세러 가기' : '밤 9시에 열려요',
    });
    if (night) expect(button).toBeEnabled();
    else expect(button).toBeDisabled();
    expect(screen.queryByText('알림을 받을까요?')).toBeNull();
    await press('설정 열기');
    await tick();
    expect(
      screen.getByLabelText('로그인 정보: member@example.com'),
    ).toBeTruthy();
  },
);
it('keeps an initialized account on screen remount and clears the account on withdrawal', async () => {
  const account = createMockReminder();
  jest.mocked(getNativeReminderSession).mockReturnValue({
    reminder: {
      ...account,
      ...createReminderConnection(
        account,
        createDeviceReminder(storedDevice().port),
      ),
    },
  } as never);
  const source = getMockAppSession();
  await render(ui(source, getMockAppSession));
  await login();
  const before = source.getJourney();
  await screen.unmount();
  await render(ui(source, getMockAppSession));
  await press('체험 시작');
  await tick();
  await tick();
  expect(getMockAppSession().getJourney()).toBe(before);
  expect(screen.getByText('아직 센 양이 없어요')).toBeTruthy();
  await press('설정 열기');
  await tick();
  await press('탈퇴 열기');
  await press('탈퇴하기');
  await tick();
  await tick();
  expect(
    screen.getByRole('button', { name: '이메일로 회원가입' }),
  ).toBeTruthy();
  expect(source.getJourney()).toBeNull();
});
it('allows startup failure retry without opening a new account or navigating to tools', async () => {
  const s = fixture(),
    load = jest
      .fn(() => s)
      .mockImplementationOnce(() => {
        throw new Error('private native detail');
      }),
    tools = jest.fn();
  await render(
    <AppEntryFlow loadSource={load} onTools={tools} onExit={() => {}} />,
  );
  await press('체험 시작');
  expect(screen.getByText('시작 준비를 마치지 못했어요')).toBeTruthy();
  expect(screen.queryByText('private native detail')).toBeNull();
  await press('체험 시작');
  expect(
    screen.getByRole('button', { name: '이메일로 회원가입' }),
  ).toBeTruthy();
});

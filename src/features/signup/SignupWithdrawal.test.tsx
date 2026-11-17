import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { SignupJourneyFlow } from './SignupJourneyFlow';
import { createMockSignupJourney } from '../../mocks/signupJourney';
import { createMockReminder } from '../../mocks/reminder';
import { createReminderConnection } from '../../notifications/connection';
import { createDeviceReminder } from '../../notifications/service';
import { storedDevice } from '../../notifications/__tests__/storedDevice';
import { complete } from '../../mocks/__tests__/nightHistory';
import type { SignupJourneySource } from './SignupJourneyFlow';
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
const tick = async () => {
  for (let i = 0; i < 2; i++)
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1500);
    });
};
function fixture(slow = false) {
  const device = storedDevice(),
    account = createMockReminder();
  const reminder = {
    ...account,
    ...createReminderConnection(account, createDeviceReminder(device.port)),
  };
  return {
    source: createMockSignupJourney(reminder, 'night', {
      withdrawalScenario: slow ? 'slow' : 'success',
    }),
    ...device,
  };
}
const ui = (source: SignupJourneySource, exit = () => {}) => (
  <SafeAreaInsetsContext.Provider
    value={{ top: 28, bottom: 24, left: 0, right: 0 }}
  >
    <SignupJourneyFlow source={source} onExit={exit} />
  </SafeAreaInsetsContext.Provider>
);
async function signup(email: string) {
  await press('이메일로 회원가입');
  expect(screen.getByLabelText('이메일 주소')).toHaveProp('value', '');
  expect(screen.getByLabelText('비밀번호')).toHaveProp('value', '');
  await fireEvent.changeText(screen.getByLabelText('이메일 주소'), email);
  await fireEvent.changeText(screen.getByLabelText('비밀번호'), 'password');
  await fireEvent.changeText(
    screen.getByLabelText('비밀번호 확인'),
    'password',
  );
  await press('다음');
  await tick();
  for (const name of [
    '[필수] 서비스 이용약관',
    '[필수] 개인정보 수집 · 이용',
    '[필수] 고민 글 외부 AI 전송',
  ])
    await fireEvent.press(screen.getByRole('checkbox', { name }));
  await press('동의하고 계속');
  await tick();
  await press('다음');
  await tick();
  await press('나중에 할게요');
  await tick();
  await tick();
}
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
it('returns to a blank signup on the same source, cannot reopen the withdrawn home, and registers a fresh account', async () => {
  const f = fixture();
  await render(ui(f.source));
  await signup('old@example.com');
  await press('설정 열기');
  await tick();
  const old = f.source.getJourney()!;
  await press('탈퇴 열기');
  await press('조금 더 있을래요');
  expect(screen.getByText('old@example.com')).toBeTruthy();
  expect(f.source.getJourney()).toBe(old);
  await press('탈퇴 열기');
  await press('탈퇴하기');
  await tick();
  expect(
    screen.getByRole('button', { name: '이메일로 회원가입' }),
  ).toBeTruthy();
  expect(screen.queryByText('old@example.com')).toBeNull();
  expect(screen.queryByRole('button', { name: '설정 열기' })).toBeNull();
  expect(f.source.getJourney()).toBeNull();
  await screen.unmount();
  await render(ui(f.source));
  expect(
    screen.getByRole('button', { name: '이메일로 회원가입' }),
  ).toBeTruthy();
  await signup('new@example.com');
  await press('설정 열기');
  await tick();
  expect(screen.getByText('new@example.com')).toBeTruthy();
  expect(screen.getByText('0밤째 양을 세는 중')).toBeTruthy();
  const me = f.source
    .getJourney()!
    .home.settings!.loadMe(new AbortController().signal);
  await tick();
  expect((await me).user.id).toBe('signup-preview-account-1');
});
it('connects withdrawal from an adopted morning home, retaining records on Android cancel and resetting on confirmation', async () => {
  const f = fixture();
  f.source.onboarding.begin(
    { id: 'old', email: 'morning@example.com' },
    { birth_date: '2000-01-01', edits_remaining: 1, zodiac: 'capricorn' },
  );
  f.source.onboarding.skip();
  await jest.runAllTimersAsync();
  const old = f.source.getJourney()!;
  await complete(old.night, 3, '이전 밤 고민');
  old.advanceMorning();
  await render(ui(f.source));
  await tick();
  await tick();
  await press('설정 열기');
  await tick();
  expect(screen.getByText('1밤째 양을 세는 중')).toBeTruthy();
  await press('탈퇴 열기');
  await fireEvent(screen.getByTestId('withdrawal-modal'), 'requestClose');
  expect(f.source.getJourney()).toBe(old);
  expect(old.history.getStats().worry_record_count).toBe(1);
  await press('탈퇴 열기');
  await press('탈퇴하기');
  await tick();
  expect(
    screen.getByRole('button', { name: '이메일로 회원가입' }),
  ).toBeTruthy();
  expect(f.source.getJourney()).toBeNull();
});
it('aborts a pending withdrawal on source replacement without deleting either account', async () => {
  const a = fixture(true);
  a.source.onboarding.begin(
    { id: 'old', email: 'old@example.com' },
    { birth_date: '2000-01-01', edits_remaining: 1, zodiac: 'capricorn' },
  );
  a.source.onboarding.skip();
  await jest.runAllTimersAsync();
  const old = a.source.getJourney()!;
  await render(ui(a.source));
  await tick();
  await press('설정 열기');
  await tick();
  await press('탈퇴 열기');
  await press('탈퇴하기');
  const b = fixture();
  await screen.rerender(ui(b.source));
  await tick();
  expect(
    screen.getByRole('button', { name: '이메일로 회원가입' }),
  ).toBeTruthy();
  expect(a.source.getJourney()).toBe(old);
  expect(b.source.getJourney()).toBeNull();
  expect(a.source.getVersion()).toBe(0);
  expect(b.source.getVersion()).toBe(0);
});

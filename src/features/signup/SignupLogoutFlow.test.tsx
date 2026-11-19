import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { SignupJourneyFlow } from './SignupJourneyFlow';
import { createMockSignupJourney } from '../../mocks/signupJourney';
import { createMockReminder } from '../../mocks/reminder';
import { createReminderConnection } from '../../notifications/connection';
import { createDeviceReminder } from '../../notifications/service';
import { storedDevice } from '../../notifications/__tests__/storedDevice';
import { complete } from '../../mocks/__tests__/nightHistory';
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
const tick = async () => {
  for (let i = 0; i < 3; i++)
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1500);
    });
};
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
async function fixture() {
  const account = createMockReminder(),
    native = storedDevice();
  const source = createMockSignupJourney(
    {
      ...account,
      ...createReminderConnection(account, createDeviceReminder(native.port)),
    },
    'night',
  );
  source.onboarding.begin(
    { id: 'a', email: 'a@example.com' },
    { birth_date: '2001-03-12', edits_remaining: 1, zodiac: 'pisces' },
  );
  source.onboarding.skip();
  await jest.runAllTimersAsync();
  const old = source.getJourney()!;
  await complete(old.night, 3, '다시 볼 고민');
  old.advanceMorning();
  let back: (() => boolean | null | undefined) | undefined;
  jest
    .spyOn(BackHandler, 'addEventListener')
    .mockImplementation((_event, callback) => {
      back = () => callback({} as Parameters<typeof callback>[0]);
      return { remove: () => {} };
    });
  const exit = jest.fn();
  await render(
    <SafeAreaInsetsContext.Provider
      value={{ top: 28, bottom: 24, left: 0, right: 0 }}
    >
      <SignupJourneyFlow source={source} onExit={exit} />
    </SafeAreaInsetsContext.Provider>,
  );
  await tick();
  await tick();
  return { source, old, exit, back: () => back?.() };
}
it.each(['home', 'my-cards'] as const)(
  'signs out through %s settings, returns to login and restores confirmed records on re-login',
  async (entry) => {
    const f = await fixture();
    if (entry === 'my-cards') {
      await press('내 카드 열기');
      await tick();
      await fireEvent.press(
        screen.getAllByRole('button', { name: '설정 열기' }).at(-1)!,
      );
    } else await press('설정 열기');
    await tick();
    await press('로그아웃 열기');
    await press('계속 있을게요');
    expect(screen.getByLabelText('로그인 정보: a@example.com')).toBeTruthy();
    expect(f.source.getJourney()).toBe(f.old);
    await press('로그아웃 열기');
    await press('로그아웃');
    await tick();
    expect(screen.getByRole('header', { name: '다시 왔네요' })).toBeTruthy();
    expect(screen.getByLabelText('이메일 주소')).toHaveDisplayValue(
      'a@example.com',
    );
    expect(screen.getByLabelText('비밀번호')).toHaveDisplayValue('');
    expect(screen.queryByLabelText('로그인 정보: a@example.com')).toBeNull();
    expect(f.source.getJourney()).toBeNull();
    await act(async () => {
      f.back();
    });
    expect(
      screen.getByRole('button', { name: '이메일로 로그인' }),
    ).toBeTruthy();
    expect(f.source.getJourney()).toBeNull();
    await press('이메일로 로그인');
    await fireEvent.changeText(
      screen.getByLabelText('이메일 주소'),
      'a@example.com',
    );
    await fireEvent.changeText(
      screen.getByLabelText('비밀번호'),
      'mock-password',
    );
    await press('로그인');
    await tick();
    await tick();
    await press('설정 열기');
    await tick();
    expect(screen.getByLabelText('로그인 정보: a@example.com')).toBeTruthy();
    expect(screen.getByText('1밤째 양을 세는 중')).toBeTruthy();
    await press('고민 기록 열기');
    await tick();
    expect(screen.getByText('다시 볼 고민')).toBeTruthy();
    expect(f.exit).not.toHaveBeenCalled();
  },
);

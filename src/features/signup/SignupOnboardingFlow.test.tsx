import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import {
  act,
  fireEvent,
  render as renderNative,
  screen,
} from '@testing-library/react-native';
import type { ComponentProps, ReactElement } from 'react';
import { HomeFlow } from '../home/HomeFlow';
import { SettingsScreen } from '../settings/SettingsScreen';
import type { SettingsData } from '../settings/types';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { SignupOnboardingFlow } from './SignupOnboardingFlow';
import { createMockSignupOnboarding } from '../../mocks/signupOnboarding';
import { createMockReminder } from '../../mocks/reminder';
import { createReminderConnection } from '../../notifications/connection';
import { createDeviceReminder } from '../../notifications/service';
import { storedDevice } from '../../notifications/__tests__/storedDevice';
import { deferred } from '../../notifications/__tests__/fakeDevice';
const tick = () =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(3000);
  });
const wrap = (ui: ReactElement) => (
  <SafeAreaInsetsContext.Provider
    value={{ top: 28, bottom: 24, left: 0, right: 0 }}
  >
    {ui}
  </SafeAreaInsetsContext.Provider>
);
const render = (ui: ReactElement) => renderNative(wrap(ui));
const press = (label: string) =>
  fireEvent.press(screen.getByRole('button', { name: label }));
function fixture(phase: 'day' | 'night' = 'day') {
  const native = storedDevice(),
    account = createMockReminder(),
    connected = createReminderConnection(
      account,
      createDeviceReminder(native.port),
    );
  const reminder = { ...account, ...connected };
  const source = createMockSignupOnboarding(reminder, phase);
  return { ...native, account, connected, reminder, source };
}
async function birth() {
  await press('이메일로 회원가입');
  await fireEvent.changeText(
    screen.getByLabelText('이메일 주소'),
    'new@example.com',
  );
  await fireEvent.changeText(screen.getByLabelText('비밀번호'), 'password');
  await fireEvent.changeText(
    screen.getByLabelText('비밀번호 확인'),
    'password',
  );
  await press('다음');
  await tick();
  for (const label of [
    '[필수] 서비스 이용약관',
    '[필수] 개인정보·입력정보 처리 안내',
  ])
    await fireEvent.press(screen.getByRole('checkbox', { name: label }));
  await press('동의하고 계속');
  await tick();
  await fireEvent(
    screen.getByRole('adjustable', { name: '출생 월' }),
    'accessibilityAction',
    { nativeEvent: { actionName: 'increment' } },
  );
  await press('다음');
  await tick();
}
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});
it('connects birth, time picker, native reminder, intro, first home and the same settings profile', async () => {
  const f = fixture();
  await render(
    <SignupOnboardingFlow
      source={f.source}
      onExit={() => {}}
      onNight={() => {}}
    />,
  );
  await birth();
  expect(f.port.requestPermission).not.toHaveBeenCalled();
  await press('알림 받을 시간, 오후 11:00');
  await fireEvent(
    screen.getByRole('adjustable', { name: '알림 분' }),
    'accessibilityAction',
    { nativeEvent: { actionName: 'increment' } },
  );
  await press('이 시간으로 정하기');
  await press('알림 허용');
  await tick();
  expect(screen.getByText('오후 11:15에 알려 드릴게요')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /알림 받을 시간/ })).toBeNull();
  await press('밤에 만나요');
  await tick();
  await tick();
  expect(screen.getByText('아직 센 양이 없어요')).toBeTruthy();
  expect(
    screen.getByRole('button', { name: '밤 9시에 열려요' }),
  ).toBeDisabled();
  await press('설정 열기');
  await tick();
  expect(screen.getByLabelText('로그인 정보: new@example.com')).toBeTruthy();
  expect(screen.getByText('2004.06.14 · 수정 1회')).toBeTruthy();
  expect(screen.getByText('켜짐 · 23:15')).toBeTruthy();
  expect(f.alarms.size).toBe(1);
});
it('skips without prompting, shows the no-reminder intro and does not repeat it on the same memory account', async () => {
  const f = fixture(),
    exit = jest.fn();
  const ui = () => (
    <SignupOnboardingFlow source={f.source} onExit={exit} onNight={() => {}} />
  );
  await render(ui());
  await birth();
  await press('나중에 할게요');
  await tick();
  expect(screen.getByText('밤 9시가 되면 다시 들러 주세요')).toBeTruthy();
  await press('밤에 만나요');
  await tick();
  await tick();
  await screen.unmount();
  await render(ui());
  await tick();
  expect(screen.getByText('아직 센 양이 없어요')).toBeTruthy();
  expect(screen.queryByText('밤에 만나요')).toBeNull();
  expect(f.port.requestPermission).not.toHaveBeenCalled();
});
it('goes straight to the first home at night', async () => {
  const f = fixture('night');
  await render(
    <SignupOnboardingFlow
      source={f.source}
      onExit={() => {}}
      onNight={() => {}}
    />,
  );
  await birth();
  await press('나중에 할게요');
  await tick();
  await tick();
  expect(screen.queryByText('밤에 만나요')).toBeNull();
  expect(
    screen.getByRole('button', { name: '오늘 밤 양 세러 가기' }),
  ).not.toBeDisabled();
});
it('explains permission denial without a success promise and allows skipping', async () => {
  const f = fixture();
  f.setPermission({ status: 'denied', canAskAgain: false, channel: 'enabled' });
  await render(
    <SignupOnboardingFlow
      source={f.source}
      onExit={() => {}}
      onNight={() => {}}
    />,
  );
  await birth();
  await press('알림 허용');
  await tick();
  expect(screen.getByRole('alert').props.children).toMatch(/권한/);
  expect(screen.getByRole('button', { name: '기기 설정 열기' })).toBeTruthy();
  expect(screen.queryByText('오후 11:00에 알려 드릴게요')).toBeNull();
  await press('알림 없이 계속하기');
  await tick();
  expect(screen.getByText('밤 9시가 되면 다시 들러 주세요')).toBeTruthy();
});
it('keeps progress at the action and disables duplicate saves, time edits and exit until scheduling completes', async () => {
  const f = fixture(),
    wait = deferred<void>();
  f.registerAlarm.mockImplementationOnce(() => wait.promise);
  await render(
    <SignupOnboardingFlow
      source={f.source}
      onExit={() => {}}
      onNight={() => {}}
    />,
  );
  await birth();
  await press('알림 허용');
  await tick();
  expect(
    screen.getByRole('button', { name: '알림 저장·예약 중' }),
  ).toBeDisabled();
  expect(
    screen.getByRole('button', { name: '알림 받을 시간, 오후 11:00' }),
  ).toBeDisabled();
  expect(screen.getByRole('button', { name: '나중에 할게요' })).toBeDisabled();
  await act(async () => wait.resolve());
  await tick();
  expect(screen.getByRole('button', { name: '밤에 만나요' })).toBeTruthy();
});
it('isolates source replacement while an old notification request finishes late', async () => {
  const f = fixture(),
    wait = deferred<void>();
  f.registerAlarm.mockImplementationOnce(() => wait.promise);
  await render(
    <SignupOnboardingFlow
      source={f.source}
      onExit={() => {}}
      onNight={() => {}}
    />,
  );
  await birth();
  await press('알림 허용');
  await tick();
  await screen.rerender(
    wrap(
      <SignupOnboardingFlow
        source={fixture().source}
        onExit={() => {}}
        onNight={() => {}}
      />,
    ),
  );
  await act(async () => wait.resolve());
  await tick();
  expect(
    screen.getByRole('button', { name: '이메일로 회원가입' }),
  ).toBeTruthy();
  expect(screen.queryByRole('button', { name: '밤에 만나요' })).toBeNull();
});
it('removes a stale delivery promise when the permission changes on the intro screen', async () => {
  const f = fixture();
  await render(
    <SignupOnboardingFlow
      source={f.source}
      onExit={() => {}}
      onNight={() => {}}
    />,
  );
  await birth();
  await press('알림 허용');
  await tick();
  expect(screen.getByText('오후 11:00에 알려 드릴게요')).toBeTruthy();
  f.setPermission({ status: 'denied', canAskAgain: false, channel: 'enabled' });
  await act(async () => {
    void f.connected.device.refresh();
    await jest.advanceTimersByTimeAsync(3000);
  });
  expect(screen.queryByText('오후 11:00에 알려 드릴게요')).toBeNull();
  expect(screen.getByText('밤 9시가 되면 다시 들러 주세요')).toBeTruthy();
});

const accountHome = ({ source, onExit }: ComponentProps<typeof HomeFlow>) => (
  <SettingsScreen actions={source.settings!} onBack={onExit} />
);
it.each(['day', 'night'] as const)(
  'mounts the supplied account home only after %s onboarding and preserves it on reopen',
  async (phase) => {
    const f = fixture(phase),
      exit = jest.fn();
    const ui = () => (
      <SignupOnboardingFlow
        source={f.source}
        onExit={exit}
        onNight={() => {}}
        renderHome={accountHome}
      />
    );
    await render(ui());
    await birth();
    expect(screen.queryByText('new@example.com')).toBeNull();
    await press('나중에 할게요');
    await tick();
    if (phase === 'day') {
      expect(screen.getByText('밤 9시가 되면 다시 들러 주세요')).toBeTruthy();
      expect(screen.queryByText('new@example.com')).toBeNull();
      await press('밤에 만나요');
    }
    await tick();
    expect(screen.getByLabelText('로그인 정보: new@example.com')).toBeTruthy();
    expect(screen.getByText('2004.06.14 · 수정 1회')).toBeTruthy();
    await press('아침 홈으로 돌아가기');
    expect(exit).toHaveBeenCalledTimes(1);
    await screen.unmount();
    await render(ui());
    await tick();
    expect(screen.getByLabelText('로그인 정보: new@example.com')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '밤에 만나요' })).toBeNull();
  },
);
it('unmounts the previous custom home and aborts its query when the signup source changes', async () => {
  const f = fixture('night'),
    late = deferred<SettingsData>();
  const ui = (source: typeof f.source) => (
    <SignupOnboardingFlow
      source={source}
      onExit={() => {}}
      onNight={() => {}}
      renderHome={accountHome}
    />
  );
  await render(ui(f.source));
  await birth();
  const home = f.source.onboarding.getSnapshot().home!,
    signal = new AbortController().signal;
  const original = home.settings!.loadMe(signal);
  await tick();
  const receipt = await original;
  const request = jest
    .spyOn(home.settings!, 'loadMe')
    .mockImplementation(() => late.promise);
  await press('나중에 할게요');
  await tick();
  expect(request).toHaveBeenCalledTimes(1);
  await screen.rerender(wrap(ui(fixture().source)));
  expect(request.mock.calls[0][0].aborted).toBe(true);
  await act(async () => late.resolve(receipt));
  await tick();
  expect(
    screen.getByRole('button', { name: '이메일로 회원가입' }),
  ).toBeTruthy();
  expect(screen.queryByText('new@example.com')).toBeNull();
});

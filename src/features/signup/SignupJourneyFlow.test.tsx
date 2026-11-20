import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import {
  act,
  fireEvent,
  render as nativeRender,
  screen,
} from '@testing-library/react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import type { ReactElement } from 'react';
import { BackHandler } from 'react-native';
import { SignupJourneyFlow } from './SignupJourneyFlow';
import { createMockSignupJourney } from '../../mocks/signupJourney';
import { createMockReminder } from '../../mocks/reminder';
import { createReminderConnection } from '../../notifications/connection';
import { createDeviceReminder } from '../../notifications/service';
import { storedDevice } from '../../notifications/__tests__/storedDevice';
import { deferred } from '../../notifications/__tests__/fakeDevice';
import type { HomeSnapshot } from '../home/model';
const wrap = (ui: ReactElement) => (
  <SafeAreaInsetsContext.Provider
    value={{ top: 28, bottom: 24, left: 0, right: 0 }}
  >
    {ui}
  </SafeAreaInsetsContext.Provider>
);
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
const tick = async () => {
  for (let i = 0; i < 2; i++)
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1500);
    });
};
function fixture(phase: 'day' | 'night' = 'day') {
  const native = storedDevice(),
    account = createMockReminder(),
    connection = createReminderConnection(
      account,
      createDeviceReminder(native.port),
    );
  return {
    ...native,
    source: createMockSignupJourney({ ...account, ...connection }, phase),
  };
}
async function signup() {
  await press('이메일로 회원가입');
  await fireEvent.changeText(
    screen.getByLabelText('이메일 주소'),
    'joined@example.com',
  );
  await fireEvent.changeText(screen.getByLabelText('비밀번호'), 'password');
  await fireEvent.changeText(
    screen.getByLabelText('비밀번호 확인'),
    'password',
  );
  await press('다음');
  await tick();
  for (const name of [
    '[필수] 서비스 이용약관',
    '[필수] 개인정보·입력정보 처리 안내',
  ])
    await fireEvent.press(screen.getByRole('checkbox', { name }));
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
  jest.restoreAllMocks();
});
it.each(['day', 'night'] as const)(
  'keeps one registered account through %s signup, first home, night, adoption and reflection',
  async (phase) => {
    const f = fixture(phase),
      ui = () =>
        wrap(<SignupJourneyFlow source={f.source} onExit={() => {}} />);
    await nativeRender(ui());
    await signup();
    await press(phase === 'day' ? '알림 허용' : '나중에 할게요');
    await tick();
    if (phase === 'day') {
      await press('밤에 만나요');
      await tick();
    }
    await tick();
    expect(screen.getByText('아직 센 양이 없어요')).toBeTruthy();
    await press('설정 열기');
    await tick();
    expect(
      screen.getByLabelText('로그인 정보: joined@example.com'),
    ).toBeTruthy();
    expect(screen.getByText('2004.06.14 · 수정 1회')).toBeTruthy();
    await press('아침 홈으로 돌아가기');
    await tick();
    if (phase === 'day') {
      expect(
        screen.getByRole('button', { name: '밤 9시에 열려요' }),
      ).toBeDisabled();
      await screen.unmount();
      f.source.advanceNight();
      await nativeRender(ui());
      await tick();
      expect(screen.queryByRole('button', { name: '밤에 만나요' })).toBeNull();
    }
    await press('오늘 밤 양 세러 가기');
    await tick();
    await fireEvent.press(screen.getByRole('radio', { name: '취업' }));
    await fireEvent.changeText(
      screen.getByLabelText('오늘의 고민'),
      '면접이 걱정돼요',
    );
    await press('다음');
    await tick();
    await press('양 세기 시작');
    await tick();
    await press('다음 양');
    await tick();
    await press('다음 양');
    await tick();
    await press('마무리하기');
    await tick();
    await press('다음');
    await press('아침에 쓸게요');
    await tick();
    await press('밤 마무리 확인');
    await press('다음 아침으로 이동');
    await tick();
    await tick();
    await press('이 양 데려오기');
    await tick();
    await press('어젯밤 돌아보기');
    await tick();
    await fireEvent.press(screen.getByRole('radio', { name: '작아졌어요' }));
    await press('회고 저장하기');
    await tick();
    await press('양떼 보러 가기');
    await press('설정 열기');
    await tick();
    expect(
      screen.getByLabelText('로그인 정보: joined@example.com'),
    ).toBeTruthy();
    expect(screen.getByText('2004.06.14 · 수정 1회')).toBeTruthy();
    expect(screen.getByText('1밤째 양을 세는 중')).toBeTruthy();
    expect(
      screen.getByText(phase === 'day' ? '켜짐 · 23:00' : '꺼짐'),
    ).toBeTruthy();
    await press('고민 기록 열기');
    await tick();
    expect(screen.getByText('면접이 걱정돼요')).toBeTruthy();
    expect(screen.getByText(/작아졌어요/)).toBeTruthy();
    expect(f.alarms.size).toBe(phase === 'day' ? 1 : 0);
    expect(f.source.signup.today).toBe('2026-11-17');
  },
);
it('aborts the previous account home and ignores its late response on source replacement', async () => {
  const f = fixture('night');
  f.source.onboarding.begin(
    { id: 'old', email: 'old@example.com' },
    { birth_date: '2000-01-01', edits_remaining: 1, zodiac: 'capricorn' },
  );
  f.source.onboarding.skip();
  await jest.runAllTimersAsync();
  const old = f.source.getJourney()!,
    late = deferred<HomeSnapshot>();
  const query = jest
    .spyOn(old.home.clock, 'load')
    .mockImplementation(() => late.promise);
  await nativeRender(
    wrap(<SignupJourneyFlow source={f.source} onExit={() => {}} />),
  );
  const next = fixture();
  await screen.rerender(
    wrap(<SignupJourneyFlow source={next.source} onExit={() => {}} />),
  );
  expect(query.mock.calls[0][0].aborted).toBe(true);
  await act(async () =>
    late.resolve({
      server_time: '2026-11-16T12:30:00Z',
      timezone: 'Asia/Seoul',
      phase: 'night',
      user: { id: 'old', stats: { night_count: 1 } },
    }),
  );
  await tick();
  expect(
    screen.getByRole('button', { name: '이메일로 회원가입' }),
  ).toBeTruthy();
  expect(screen.queryByRole('header', { name: /^나의 양떼/ })).toBeNull();
  expect(next.source.getJourney()).toBeNull();
});
it('continues a second night on the same registered account and deletes one dated worry without losing either sheep', async () => {
  const f = fixture('night');
  const ui = () =>
    wrap(<SignupJourneyFlow source={f.source} onExit={() => {}} />);
  await nativeRender(ui());
  await signup();
  await press('나중에 할게요');
  await tick();
  await tick();
  for (let day = 0; day < 2; day++) {
    if (day) {
      await screen.unmount();
      f.source.advanceNight();
      await nativeRender(ui());
      await tick();
      await tick();
    }
    await press('오늘 밤 양 세러 가기');
    await tick();
    await fireEvent.press(screen.getByRole('radio', { name: '취업' }));
    await fireEvent.changeText(
      screen.getByLabelText('오늘의 고민'),
      day ? '둘째 밤 고민' : '첫째 밤 고민',
    );
    await press('다음');
    await tick();
    await press('양 세기 시작');
    await tick();
    await press('다음 양');
    await tick();
    await press('다음 양');
    await tick();
    await press('마무리하기');
    await tick();
    await press('다음');
    await press('아침에 쓸게요');
    await tick();
    await press('밤 마무리 확인');
    await press('다음 아침으로 이동');
    await tick();
    await tick();
    await press('이 양 데려오기');
    await tick();
    await press('어젯밤 돌아보기');
    await tick();
    await fireEvent.press(
      screen.getByRole('radio', {
        name: day ? '다른 고민이 생겼어요' : '작아졌어요',
      }),
    );
    await press('회고 저장하기');
    await tick();
    await press('양떼 보러 가기');
  }
  const source = f.source.getJourney()!;
  const flock = await act(async () => {
    const p = source.home.morning.loadFlock(new AbortController().signal);
    await jest.advanceTimersByTimeAsync(1000);
    return p;
  });
  expect(flock.map((s) => s.night_date)).toEqual(['2026-11-17', '2026-11-16']);
  await press('설정 열기');
  await tick();
  expect(screen.getByLabelText('로그인 정보: joined@example.com')).toBeTruthy();
  expect(screen.getByText('2밤째 양을 세는 중')).toBeTruthy();
  await press('고민 기록 열기');
  await tick();
  expect(screen.getByText('첫째 밤 고민')).toBeTruthy();
  expect(screen.getByText('둘째 밤 고민')).toBeTruthy();
  await fireEvent.press(
    screen.getByRole('checkbox', { name: '2026-11-16 고민 선택' }),
  );
  await press('선택한 1개 지우기');
  await press('지울게요');
  await tick();
  expect(screen.queryByText('첫째 밤 고민')).toBeNull();
  expect(screen.getByText('둘째 밤 고민')).toBeTruthy();
  await press('설정으로 돌아가기');
  await tick();
  expect(screen.getByText('1개')).toBeTruthy();
  expect(screen.getByText('2밤째 양을 세는 중')).toBeTruthy();
});
it('resumes the same dated session after returning through home without starting or counting another night', async () => {
  const f = fixture('night');
  f.source.onboarding.begin(
    { id: 'returning', email: 'returning@example.com' },
    { birth_date: '2001-03-12', edits_remaining: 1, zodiac: 'pisces' },
  );
  f.source.onboarding.skip();
  await jest.runAllTimersAsync();
  let back: (() => boolean | null | undefined) | undefined;
  jest
    .spyOn(BackHandler, 'addEventListener')
    .mockImplementation((_event, callback) => {
      back = () => callback({} as Parameters<typeof callback>[0]);
      return { remove: () => {} };
    });
  const journey = f.source.getJourney()!,
    count = jest.spyOn(journey.night.entry, 'startCounting');
  await nativeRender(
    wrap(<SignupJourneyFlow source={f.source} onExit={() => {}} />),
  );
  await tick();
  await press('오늘 밤 양 세러 가기');
  await tick();
  await fireEvent.press(screen.getByRole('radio', { name: '취업' }));
  await fireEvent.changeText(
    screen.getByLabelText('오늘의 고민'),
    '잠깐 쉬었다 이어 볼 고민',
  );
  await press('다음');
  await tick();
  await press('양 세기 시작');
  await tick();
  await press('다음 양');
  await tick();
  await act(async () => {
    back?.();
  });
  await press('홈으로 돌아가기');
  await tick();
  await tick();
  await press('오늘 밤 양 세러 가기');
  await tick();
  await press('이어 보기');
  await tick();
  expect(screen.getByLabelText('양 세기 진행')).toHaveTextContent('2 / 3');
  expect(count).toHaveBeenCalledTimes(1);
  expect(journey.history.getStats()).toEqual({
    night_count: 1,
    counted_sheep_total: 2,
    worry_record_count: 1,
  });
});

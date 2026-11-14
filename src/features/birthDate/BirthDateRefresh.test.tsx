import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { MorningScreen } from '../morning/MorningScreen';
import type { Fortune, FortuneActions } from '../fortune/types';
import type { SettingsActions, SettingsData } from '../settings/types';
import { createSettingsMorning } from '../../mocks/settingsMorning';
import { createMockBirthDate } from '../../mocks/birthDate';
const tick = () =>
  act(async () => {
    await jest.runAllTimersAsync();
  });
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
async function open(source: ReturnType<typeof createSettingsMorning>) {
  await render(
    <MorningScreen
      actions={source}
      loadDetail={source.loadSheep}
      onExit={() => {}}
    />,
  );
  await tick();
  await press('설정 열기');
  await tick();
}
async function choose() {
  await press('생년월일 열기');
  await tick();
  await fireEvent(
    screen.getByRole('adjustable', { name: '출생 월' }),
    'accessibilityAction',
    { nativeEvent: { actionName: 'increment' } },
  );
  await press('한 번만 바꿀 수 있어요!');
}
async function save() {
  await press('이 생일로 변경하기');
  await tick();
}
async function home() {
  await press('아침 홈으로 돌아가기');
  await tick();
  await press('오늘의 운세 보기');
}
afterEach(() => {
  jest.useRealTimers();
});
it.each(['profile', 'fortune'] as const)(
  'keeps a committed birthday when the %s refresh fails and retries only that read',
  async (failure) => {
    jest.useFakeTimers();
    const source = createSettingsMorning('success', {
      profileRefreshFailure: failure === 'profile',
      fortuneRefreshFailure: failure === 'fortune',
    });
    const send = jest.spyOn(source.settings.birthDate, 'save');
    await open(source);
    await choose();
    await save();
    await press('돌아가기');
    await tick();
    if (failure === 'profile') {
      expect(screen.getByText('생일 확인 필요')).toBeTruthy();
      expect(screen.getByText('생일 정보도 다시 확인해 주세요.')).toBeTruthy();
      expect(screen.queryByText('2004.05.14 · 수정 1회')).toBeNull();
      await press('기록 개수 다시 확인');
      await tick();
    }
    expect(screen.getByText('2004.06.14 · 수정 0회')).toBeTruthy();
    await home();
    if (failure === 'fortune') {
      expect(screen.getByText('오늘의 운세를 불러오지 못했어요')).toBeTruthy();
      expect(screen.queryByText(/황소자리/)).toBeNull();
      await press('운세 다시 불러오기');
      await tick();
    }
    expect(screen.getByText('쌍둥이자리')).toBeTruthy();
    expect(screen.getByText('느긋한 양')).toBeTruthy();
    expect(send).toHaveBeenCalledTimes(1);
    await press('오늘의 운세 닫기');
    await press('오늘의 운세 보기');
    expect(screen.getByText('느긋한 양')).toBeTruthy();
  },
);
it('reconciles a committed birthday after its lost response is closed without resending', async () => {
  jest.useFakeTimers();
  const source = createSettingsMorning('success', {
    birthDate: createMockBirthDate('lost-response'),
  });
  const send = jest.spyOn(source.settings.birthDate, 'save');
  await open(source);
  await choose();
  await save();
  expect(screen.getByText('변경 결과를 확인하지 못했어요')).toBeTruthy();
  await press('생년월일 변경 닫기');
  await tick();
  expect(screen.getByText('2004.06.14 · 수정 0회')).toBeTruthy();
  await home();
  expect(screen.getByText('쌍둥이자리')).toBeTruthy();
  expect(send).toHaveBeenCalledTimes(1);
});
it('uses the authoritative conflicting birthday rather than the attempted date in both profile and fortune', async () => {
  jest.useFakeTimers();
  const source = createSettingsMorning('success', {
    birthDate: createMockBirthDate('conflict'),
  });
  await open(source);
  await choose();
  await save();
  expect(screen.getByText('선택한 생일을 저장하지 못했어요.')).toBeTruthy();
  await press('돌아가기');
  await tick();
  expect(screen.getByText('2002.06.15 · 수정 0회')).toBeTruthy();
  expect(screen.queryByText('2004.06.14 · 수정 0회')).toBeNull();
  await home();
  expect(screen.getByText('쌍둥이자리')).toBeTruthy();
});
it.each(['cancel', 'rejected'] as const)(
  'retains the original birthday and daily fortune after %s',
  async (mode) => {
    jest.useFakeTimers();
    const source = createSettingsMorning('success', {
      birthDate: createMockBirthDate(
        mode === 'rejected' ? 'validation-error' : 'success',
      ),
    });
    const send = jest.spyOn(source.settings.birthDate, 'save');
    await open(source);
    await choose();
    if (mode === 'rejected') {
      await save();
      expect(
        screen.getByText('생년월일을 확인해 주세요. 선택한 날짜는 그대로예요.'),
      ).toBeTruthy();
    }
    await press('생년월일 변경 닫기');
    await tick();
    expect(screen.getByText('2004.05.14 · 수정 1회')).toBeTruthy();
    await home();
    expect(screen.getByText('오늘의 3등 양! ✦ · 황소자리')).toBeTruthy();
    expect(send).toHaveBeenCalledTimes(mode === 'cancel' ? 0 : 1);
  },
);
it.each(['success', 'failure'] as const)(
  'aborts an old in-flight fortune on settings return and ignores its late %s',
  async (mode) => {
    jest.useFakeTimers();
    const source = createSettingsMorning();
    const original = source.fortune.load;
    let finish!: (data: Fortune) => void, fail!: (error: Error) => void;
    const load = jest
      .fn<FortuneActions['load']>()
      .mockImplementationOnce(
        () =>
          new Promise((resolve, reject) => {
            finish = resolve;
            fail = reject;
          }),
      )
      .mockImplementation(original);
    source.fortune.load = load;
    await open(source);
    await choose();
    await save();
    await press('돌아가기');
    await tick();
    await home();
    expect(screen.getByText('쌍둥이자리')).toBeTruthy();
    expect(load.mock.calls[0][0].aborted).toBe(true);
    await act(async () => {
      if (mode === 'success')
        finish({
          date: '2026-11-14',
          zodiac: 'taurus',
          rank: 1,
          sheep_type: 'sparkling',
          message: 'stale daily result',
          lucky_color: 'old color',
          lucky_item: 'old item',
          small_action: 'old action',
        });
      else fail(new Error('late fortune failure'));
    });
    expect(screen.getByText('쌍둥이자리')).toBeTruthy();
    expect(screen.queryByText('stale daily result')).toBeNull();
    expect(screen.queryByText('오늘의 운세를 불러오지 못했어요')).toBeNull();
  },
);
it('restarts a pending profile read after editing and never restores the previous birthday or quota', async () => {
  jest.useFakeTimers();
  const source = createSettingsMorning();
  const original = source.settings.loadMe;
  const pending = original(new AbortController().signal);
  await tick();
  const old = await pending;
  let finish!: (data: SettingsData) => void;
  const load = jest
    .fn<SettingsActions['loadMe']>()
    .mockImplementationOnce(original)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockImplementation(original);
  source.settings.loadMe = load;
  await open(source);
  await press('고민 기록 열기');
  await tick();
  await press('설정으로 돌아가기');
  expect(screen.getByText('생일 확인 중')).toBeTruthy();
  expect(screen.queryByText('2004.05.14 · 수정 1회')).toBeNull();
  await choose();
  await save();
  await press('돌아가기');
  await tick();
  expect(load.mock.calls[1][0].aborted).toBe(true);
  await act(async () => finish(old));
  expect(screen.getByText('2004.06.14 · 수정 0회')).toBeTruthy();
  expect(screen.queryByText('2004.05.14 · 수정 1회')).toBeNull();
  await press('고민 기록 열기');
  await tick();
  expect(screen.getByText('고민 기록 3개')).toBeTruthy();
});
it('closes the old account editor, aborts its save and ignores a late result after the morning source changes', async () => {
  jest.useFakeTimers();
  const source = createSettingsMorning();
  let finish!: (
    value: Awaited<ReturnType<typeof source.settings.birthDate.save>>,
  ) => void;
  const send = jest.spyOn(source.settings.birthDate, 'save').mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await open(source);
  await choose();
  await press('이 생일로 변경하기');
  const next = createSettingsMorning();
  await screen.rerender(<MorningScreen actions={next} onExit={() => {}} />);
  await tick();
  expect(send.mock.calls[0][1].aborted).toBe(true);
  expect(screen.queryByTestId('birth-date-modal')).toBeNull();
  await act(async () =>
    finish({ birth_date: '2004-06-14', edits_remaining: 0, zodiac: 'gemini' }),
  );
  await press('설정 열기');
  await tick();
  expect(screen.getByText('2004.05.14 · 수정 1회')).toBeTruthy();
  expect(screen.queryByText('2004.06.14 · 수정 0회')).toBeNull();
});
it.each(['date', 'quota'] as const)(
  'rejects an invalid %s in a connected profile instead of displaying it as current',
  async (field) => {
    jest.useFakeTimers();
    const source = createSettingsMorning();
    const pending = source.settings.loadMe(new AbortController().signal);
    await tick();
    const value = await pending;
    source.settings.loadMe = async () => ({
      ...value,
      user: {
        ...value.user,
        ...(field === 'date'
          ? { birth_date: '2004-02-30' }
          : { birth_date_edits_remaining: 2 }),
      },
    });
    await open(source);
    expect(screen.getByText('설정을 불러오지 못했어요.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '생년월일 열기' })).toBeNull();
  },
);

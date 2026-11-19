import { afterEach, expect, it, jest } from '@jest/globals';
import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';
import { MyCardsWritingFlow } from './MyCardsWritingFlow';
import { createMockMyCards } from '../../mocks/myCards';
import { createSettingsMorning } from '../../mocks/settingsMorning';
import { createMockHome } from '../../mocks/firstNightHome';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { HomeFlow } from '../home/HomeFlow';
import type { SettingsData } from '../settings/types';
const openSettings = () =>
  fireEvent.press(
    within(screen.getByTestId('my-cards-navigation')).getByRole('button', {
      name: '설정 열기',
    }),
  );
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
async function tick() {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1000);
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1000);
  });
}
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});
it('opens the paired settings and returns to the same filter, list and writing draft', async () => {
  jest.useFakeTimers();
  const source = createMockMyCards(),
    settings = createSettingsMorning().settings;
  const load = jest.spyOn(source, 'load'),
    home = jest.fn();
  await render(
    <MyCardsWritingFlow source={source} settings={settings} onBack={home} />,
  );
  await tick();
  await press('카드 쓰기');
  await fireEvent.press(screen.getByRole('radio', { name: '취업' }));
  await press('다음');
  await fireEvent.changeText(
    screen.getByLabelText('짧은 글'),
    '돌아와서 이어 쓸 내용',
  );
  await press('이전');
  await press('이전');
  await fireEvent.press(screen.getByRole('tab', { name: '반려' }));
  await tick();
  const reads = load.mock.calls.length;
  await openSettings();
  await tick();
  expect(screen.getByLabelText('로그인 정보: yang@example.com')).toBeTruthy();
  await press('고민 기록 열기');
  await tick();
  await press('설정으로 돌아가기');
  await tick();
  await press('내 카드로 돌아가기');
  expect(screen.getByRole('tab', { name: '반려' })).toBeSelected();
  expect(load).toHaveBeenCalledTimes(reads);
  expect(home).not.toHaveBeenCalled();
  await openSettings();
  await tick();
  await press('고민 기록 열기');
  await tick();
  await fireEvent(screen.getByTestId('settings-modal'), 'requestClose');
  await tick();
  expect(
    screen.getByRole('button', { name: '내 카드로 돌아가기' }),
  ).toBeTruthy();
  await fireEvent(screen.getByTestId('settings-modal'), 'requestClose');
  expect(screen.getByRole('tab', { name: '반려' })).toBeSelected();
  expect(home).not.toHaveBeenCalled();
  await press('카드 쓰기');
  expect(screen.getByLabelText('짧은 글')).toHaveDisplayValue(
    '돌아와서 이어 쓸 내용',
  );
});
it('cancels old settings on source replacement and ignores their late response', async () => {
  jest.useFakeTimers();
  const source = createMockMyCards(),
    settings = createSettingsMorning().settings;
  let signal!: AbortSignal, finish!: (value: SettingsData) => void;
  const valuePromise = settings.loadMe(new AbortController().signal);
  await tick();
  const old = await valuePromise;
  const previous = {
    ...settings,
    loadMe: async (value: AbortSignal) => {
      signal = value;
      return new Promise<SettingsData>((resolve) => {
        finish = resolve;
      });
    },
  };
  const next = {
    ...settings,
    loadMe: async () => ({
      ...old,
      user: { ...old.user, email: 'next@example.com', id: 'next-user' },
    }),
  };
  const view = await render(
    <MyCardsWritingFlow
      source={source}
      settings={previous}
      onBack={() => {}}
    />,
  );
  await tick();
  await openSettings();
  await tick();
  await view.rerender(
    <MyCardsWritingFlow source={source} settings={next} onBack={() => {}} />,
  );
  expect(signal.aborted).toBe(true);
  await act(async () => {
    finish(old);
  });
  await openSettings();
  await tick();
  expect(screen.getByLabelText('로그인 정보: next@example.com')).toBeTruthy();
  expect(screen.queryByLabelText('로그인 정보: yang@example.com')).toBeNull();
});
it.each(['day', 'adopted'] as const)(
  'connects %s home cards to the same birthday and refreshes fortune on returning home',
  async (scenario) => {
    jest.useFakeTimers();
    const source = createMockHome(scenario),
      exit = jest.fn();
    await render(
      <SafeAreaInsetsContext.Provider
        value={{ top: 28, bottom: 24, left: 0, right: 0 }}
      >
        <HomeFlow source={source} onExit={exit} onNight={() => {}} />
      </SafeAreaInsetsContext.Provider>,
    );
    await tick();
    await press('내 카드 열기');
    await tick();
    await openSettings();
    await tick();
    await press('생년월일 열기');
    await tick();
    await fireEvent(
      screen.getByRole('adjustable', { name: '출생 월' }),
      'accessibilityAction',
      { nativeEvent: { actionName: 'increment' } },
    );
    await press('한 번만 바꿀 수 있어요!');
    await press('이 생일로 변경하기');
    await tick();
    await press('돌아가기');
    await tick();
    expect(screen.getByText('2004.06.14 · 수정 0회')).toBeTruthy();
    await press('내 카드로 돌아가기');
    await press('홈으로 돌아가기');
    await tick();
    await press('오늘의 운세 보기');
    await tick();
    expect(screen.getByText('쌍둥이자리')).toBeTruthy();
    expect(exit).not.toHaveBeenCalled();
  },
);

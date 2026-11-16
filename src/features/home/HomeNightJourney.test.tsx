import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import {
  act,
  fireEvent,
  render as nativeRender,
  screen,
} from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import type { ReactElement } from 'react';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { HomeNightJourney } from './HomeNightJourney';
import { createMockHomeJourney } from '../../mocks/homeJourney';
import { deferred } from '../../notifications/__tests__/fakeDevice';
import type { HomeSnapshot } from './model';
const wrap = (ui: ReactElement) => (
  <SafeAreaInsetsContext.Provider
    value={{ top: 28, bottom: 24, left: 0, right: 0 }}
  >
    {ui}
  </SafeAreaInsetsContext.Provider>
);
const render = (ui: ReactElement) => nativeRender(wrap(ui));
const press = (label: string) =>
  fireEvent.press(screen.getByRole('button', { name: label }));
const tick = async () => {
  for (let i = 0; i < 2; i++)
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1200);
    });
};
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
async function start() {
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
}
async function complete() {
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
}
it('connects one first home through a night, morning adoption and reflection to shared profile and worry records', async () => {
  const source = createMockHomeJourney();
  await render(<HomeNightJourney source={source} onExit={() => {}} />);
  await tick();
  expect(screen.getByText('아직 센 양이 없어요')).toBeTruthy();
  await start();
  await complete();
  await press('다음 아침으로 이동');
  await tick();
  await tick();
  expect(screen.getByRole('button', { name: '이 양 데려오기' })).toBeTruthy();
  await press('이 양 데려오기');
  await tick();
  expect(screen.getByText('나의 양떼')).toBeTruthy();
  expect(
    screen.getByRole('button', { name: '밤 9시에 열려요' }),
  ).toBeDisabled();
  await press('어젯밤 돌아보기');
  await tick();
  await fireEvent.press(screen.getByRole('radio', { name: '작아졌어요' }));
  await press('회고 저장하기');
  await tick();
  await press('양떼 보러 가기');
  await press('설정 열기');
  await tick();
  expect(screen.getByText('1밤째 양을 세는 중')).toBeTruthy();
  expect(screen.getByText('1개')).toBeTruthy();
  await press('고민 기록 열기');
  await tick();
  expect(screen.getByText('면접이 걱정돼요')).toBeTruthy();
  expect(screen.getByText(/작아졌어요/)).toBeTruthy();
  await fireEvent.press(
    screen.getByRole('checkbox', { name: '2026-11-16 고민 선택' }),
  );
  await press('선택한 1개 지우기');
  await press('지울게요');
  await tick();
  expect(screen.queryByText('면접이 걱정돼요')).toBeNull();
  await press('설정으로 돌아가기');
  await tick();
  expect(screen.getByText('0개')).toBeTruthy();
  await press('아침 홈으로 돌아가기');
  await tick();
  expect(
    await act(async () => {
      const p = source.home.morning.loadFlock(new AbortController().signal);
      await jest.advanceTimersByTimeAsync(1000);
      return p;
    }),
  ).toHaveLength(1);
});
it('returns through home without restarting the feed or losing the last and furthest positions', async () => {
  let back: (() => boolean | null | undefined) | undefined;
  jest
    .spyOn(BackHandler, 'addEventListener')
    .mockImplementation((_event, callback) => {
      back = () => callback({} as Parameters<typeof callback>[0]);
      return { remove: () => {} };
    });
  const source = createMockHomeJourney(),
    startRequest = jest.spyOn(source.night.entry, 'startCounting');
  await render(<HomeNightJourney source={source} onExit={() => {}} />);
  await tick();
  await start();
  await press('다음 양');
  await tick();
  await press('다음 양');
  await tick();
  await press('이전 양');
  await tick();
  await act(async () => {
    back?.();
  });
  await press('홈으로 돌아가기');
  await tick();
  await tick();
  expect(screen.getByText('아직 센 양이 없어요')).toBeTruthy();
  await press('오늘 밤 양 세러 가기');
  await tick();
  await press('이어 보기');
  await tick();
  expect(screen.getByLabelText('양 세기 진행')).toHaveTextContent('2 / 3');
  expect(source.night.getProgress()).toEqual({
    position: 2,
    furthestPosition: 3,
  });
  expect(startRequest).toHaveBeenCalledTimes(1);
});
it('reopens confirmed worry input at count selection without submitting another worry', async () => {
  const source = createMockHomeJourney(),
    check = jest.spyOn(source.night.entry, 'checkWorry');
  await render(<HomeNightJourney source={source} onExit={() => {}} />);
  await tick();
  await press('오늘 밤 양 세러 가기');
  await tick();
  await fireEvent.press(screen.getByRole('radio', { name: '고민 없음' }));
  await press('다음');
  await tick();
  await press('뒤로');
  await press('뒤로');
  await tick();
  await tick();
  await press('오늘 밤 양 세러 가기');
  await tick();
  expect(screen.getByRole('button', { name: '양 세기 시작' })).toBeTruthy();
  expect(check).toHaveBeenCalledTimes(1);
});
it('keeps a closing request across home and recovers a morning query without counting a second night', async () => {
  const source = createMockHomeJourney('morning-retry');
  await render(<HomeNightJourney source={source} onExit={() => {}} />);
  await tick();
  await start();
  await complete();
  await press('홈으로 돌아가기');
  await tick();
  await tick();
  await press('설정 열기');
  await tick();
  expect(screen.getByText('1밤째 양을 세는 중')).toBeTruthy();
  await press('아침 홈으로 돌아가기');
  await press('오늘 밤 양 세러 가기');
  await tick();
  await press('다음 아침으로 이동');
  await tick();
  await tick();
  expect(screen.getByRole('button', { name: '다시 불러오기' })).toBeTruthy();
  await press('다시 불러오기');
  await tick();
  expect(screen.getByRole('button', { name: '이 양 데려오기' })).toBeTruthy();
  expect(
    (
      await act(async () => {
        const p = source.home.settings!.loadMe(new AbortController().signal);
        await jest.advanceTimersByTimeAsync(1000);
        return p;
      })
    ).user.stats.night_count,
  ).toBe(1);
});
it('aborts a previous account query and ignores its late response after source replacement', async () => {
  const old = createMockHomeJourney(),
    late = deferred<HomeSnapshot>(),
    load = jest
      .spyOn(old.home.clock, 'load')
      .mockImplementation(() => late.promise);
  await render(<HomeNightJourney source={old} onExit={() => {}} />);
  await act(async () => {});
  await screen.rerender(
    wrap(
      <HomeNightJourney source={createMockHomeJourney()} onExit={() => {}} />,
    ),
  );
  await tick();
  expect(load.mock.calls[0][0].aborted).toBe(true);
  await act(async () =>
    late.resolve({
      server_time: '2026-11-16T21:00:00+09:00',
      phase: 'night',
      timezone: 'Asia/Seoul',
      user: { id: 'old', stats: { night_count: 99 } },
    }),
  );
  expect(screen.getByText('아직 센 양이 없어요')).toBeTruthy();
});
it('aborts a previous account finish and ignores its late result after a new account is shown', async () => {
  const old = createMockHomeJourney(),
    late = deferred<import('../night/closing/types').ClosingResult>();
  const finish = jest
    .spyOn(old.night.closing, 'finish')
    .mockImplementation(() => late.promise);
  await render(<HomeNightJourney source={old} onExit={() => {}} />);
  await tick();
  await start();
  await press('다음 양');
  await tick();
  await press('다음 양');
  await tick();
  await press('마무리하기');
  await tick();
  expect(finish).toHaveBeenCalledTimes(1);
  await screen.rerender(
    wrap(
      <HomeNightJourney source={createMockHomeJourney()} onExit={() => {}} />,
    ),
  );
  await tick();
  expect(finish.mock.calls[0][2].aborted).toBe(true);
  await act(async () =>
    late.resolve({
      summary: { counted: 3, entrusted_count: 0, fluff_count: 0 },
      closing_card: null,
      writing_offer: { state: 'offered' },
    }),
  );
  expect(screen.getByText('아직 센 양이 없어요')).toBeTruthy();
  expect(screen.queryByText('3마리 다 셌어요')).toBeNull();
});

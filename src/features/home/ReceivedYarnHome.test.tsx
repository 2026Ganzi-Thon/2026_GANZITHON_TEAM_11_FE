import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { HomeNightJourney } from './HomeNightJourney';
import { createMockMultiNightJourney } from '../../mocks/multiNightJourney';
import { complete, settle, signal } from '../../mocks/__tests__/nightHistory';
import { deferred } from '../../notifications/__tests__/fakeDevice';
import type { HomeSnapshot } from './model';
const original = Object.getOwnPropertyDescriptor(AppState, 'currentState');
const callbacks = new Set<(state: AppStateStatus) => void>();
beforeEach(() => {
  jest.useFakeTimers();
  Object.defineProperty(AppState, 'currentState', {
    value: 'active',
    writable: true,
    configurable: true,
  });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, cb) => {
    callbacks.add(cb);
    return {
      remove: () => {
        callbacks.delete(cb);
      },
    };
  });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  callbacks.clear();
  if (original) Object.defineProperty(AppState, 'currentState', original);
});
const tick = async () => {
  for (let i = 0; i < 2; i++)
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1500);
    });
};
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
const shown = () =>
  fireEvent(screen.getByTestId('received-yarn-modal'), 'show');
function fixture(
  receivedYarnScenario: 'success' | 'seen-retry' | 'slow-seen' = 'success',
) {
  let time = Date.parse('2026-11-16T21:30:00+09:00');
  const s = createMockMultiNightJourney({
    identity: { id: 'joined', email: 'joined@example.com' },
    receivedYarnScenario,
    clock: {
      now: () => time,
      advanceMorning: (date) => {
        time = Date.parse(`${date}T04:00:00+09:00`) + 86400000;
      },
    },
  });
  return {
    s,
    set: (value: string) => {
      time = Date.parse(value);
    },
  };
}
const ui = (s: ReturnType<typeof fixture>['s']) => (
  <SafeAreaInsetsContext.Provider
    value={{ top: 28, bottom: 24, left: 0, right: 0 }}
  >
    <HomeNightJourney source={s} onExit={() => {}} />
  </SafeAreaInsetsContext.Provider>
);
it('automatically presents once on the integrated morning home and reopens with the bell after the same account remounts', async () => {
  const { s } = fixture();
  s.previewReceiveYarn(3);
  await complete(s.night);
  s.advanceMorning();
  await render(ui(s));
  await tick();
  await tick();
  expect(screen.getByText('털실 3개가 도착했어요')).toBeTruthy();
  await shown();
  await tick();
  await press('받은 털실 닫기');
  await screen.unmount();
  await render(ui(s));
  await tick();
  await tick();
  expect(screen.queryByTestId('received-yarn-modal')).toBeNull();
  await press('받은 털실 알림 열기');
  await tick();
  expect(screen.getByText('털실 3개가 도착했어요')).toBeTruthy();
  await shown();
  await tick();
  await press('받은 털실 닫기');
  await press('내 카드 열기');
  await tick();
  expect(screen.getByText(/· 털실 2개$/)).toBeTruthy();
  expect(screen.getByText(/· 털실 1개$/)).toBeTruthy();
});
it('never auto-loads a popup on the first-night empty home even when an incoming fixture exists', async () => {
  const { s, set } = fixture();
  s.previewReceiveYarn(3);
  set('2026-11-17T04:00:00+09:00');
  const port = s.home.resolveMorning!(
    await settle(s.home.clock.load(signal())),
  ).receivedYarn!;
  const load = jest.spyOn(port, 'load');
  await render(ui(s));
  await tick();
  await tick();
  expect(screen.getByText('아직 센 양이 없어요')).toBeTruthy();
  expect(screen.queryByTestId('received-yarn-modal')).toBeNull();
  expect(load).not.toHaveBeenCalled();
});
it.each(['success', 'failure'] as const)(
  'blocks the previous popup during the foreground clock check and handles its %s before choosing a dated summary',
  async (outcome) => {
    const f = fixture(),
      s = f.s;
    s.previewReceiveYarn(3);
    await complete(s.night);
    s.advanceMorning();
    await render(ui(s));
    await tick();
    await tick();
    await shown();
    await tick();
    await press('받은 털실 닫기');
    await act(async () => {
      Object.defineProperty(AppState, 'currentState', {
        value: 'background',
        writable: true,
        configurable: true,
      });
      for (const cb of [...callbacks]) cb('background');
    });
    f.set('2026-11-17T21:30:00+09:00');
    s.enterNight();
    s.previewReceiveYarn(1);
    await complete(s.night);
    s.advanceMorning();
    const next = await settle(s.home.clock.load(signal()));
    const late = deferred<HomeSnapshot>();
    jest.spyOn(s.home.clock, 'load').mockImplementationOnce(() => late.promise);
    await act(async () => {
      Object.defineProperty(AppState, 'currentState', {
        value: 'active',
        writable: true,
        configurable: true,
      });
      for (const cb of [...callbacks]) cb('active');
    });
    expect(screen.queryByTestId('received-yarn-modal')).toBeNull();
    expect(
      screen.getByRole('button', { name: '받은 털실 알림 열기' }),
    ).toBeDisabled();
    await act(async () =>
      outcome === 'success'
        ? late.resolve(next)
        : late.reject(new Error('clock')),
    );
    await tick();
    await tick();
    if (outcome === 'success') {
      expect(screen.getByText('털실 1개가 도착했어요')).toBeTruthy();
      expect(screen.getByText('2026.11.18 집계')).toBeTruthy();
    } else {
      expect(screen.queryByTestId('received-yarn-modal')).toBeNull();
      expect(
        screen.getByRole('button', { name: '받은 털실 알림 열기' }),
      ).toBeDisabled();
    }
  },
);

it.each(['seen-retry', 'slow-seen'] as const)(
  'keeps a displayed %s popup quiet after home remount and allows manual recovery',
  async (scenario) => {
    const { s } = fixture(scenario);
    s.previewReceiveYarn(3);
    await complete(s.night);
    s.advanceMorning();
    await render(ui(s));
    await tick();
    await tick();
    await shown();
    if (scenario === 'seen-retry') {
      await tick();
      expect(
        screen.getByText('확인 상태가 저장됐는지 알 수 없어요.'),
      ).toBeTruthy();
    }
    await screen.unmount();
    await render(ui(s));
    await tick();
    await tick();
    expect(screen.queryByTestId('received-yarn-modal')).toBeNull();
    await press('받은 털실 알림 열기');
    await tick();
    expect(screen.getByText('털실 3개가 도착했어요')).toBeTruthy();
    await shown();
    await tick();
    await tick();
    expect(
      screen.queryByText('확인 상태가 저장됐는지 알 수 없어요.'),
    ).toBeNull();
    expect(screen.queryByText('확인 상태를 저장하고 있어요')).toBeNull();
  },
);

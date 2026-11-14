import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SettingsScreen } from '../settings/SettingsScreen';
import { createSettingsMorning } from '../../mocks/settingsMorning';
import { createMockReminder } from '../../mocks/reminder';
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
const tick = () =>
  act(async () => {
    await jest.runAllTimersAsync();
  });
afterEach(() => {
  jest.useRealTimers();
});
it('shares a saved reminder with settings and preserves birthday and worry entry points', async () => {
  jest.useFakeTimers();
  const source = createSettingsMorning();
  await render(<SettingsScreen actions={source.settings} onBack={() => {}} />);
  await tick();
  await press('밤에 와 알림 열기');
  await tick();
  await fireEvent(screen.getByRole('switch'), 'valueChange', true);
  await press('저장');
  await tick();
  await press('설정으로 돌아가기');
  await tick();
  expect(screen.getByText('켜짐 · 23:00')).toBeTruthy();
  expect(screen.getByRole('button', { name: '생년월일 열기' })).toBeTruthy();
  expect(screen.getByRole('button', { name: '고민 기록 열기' })).toBeTruthy();
  await press('밤에 와 알림 열기');
  await tick();
  expect(screen.getByRole('switch')).toHaveProp('value', true);
  await fireEvent(screen.getByRole('switch'), 'valueChange', false);
  await press('저장');
  await tick();
  await press('설정으로 돌아가기');
  await tick();
  expect(screen.getByText('꺼짐')).toBeTruthy();
});
it('reconciles a committed but lost save through settings without sending a different target', async () => {
  jest.useFakeTimers();
  const reminder = createMockReminder('lost-response');
  const save = jest.spyOn(reminder, 'save');
  const source = createSettingsMorning('success', { reminder });
  await render(<SettingsScreen actions={source.settings} onBack={() => {}} />);
  await tick();
  await press('밤에 와 알림 열기');
  await tick();
  await fireEvent(screen.getByRole('switch'), 'valueChange', true);
  await press('저장');
  await tick();
  expect(
    screen.getByRole('button', { name: '같은 설정으로 다시 확인' }),
  ).toBeTruthy();
  await press('알림 설정 닫기');
  await tick();
  expect(screen.getByText('켜짐 · 23:00')).toBeTruthy();
  await press('밤에 와 알림 열기');
  await tick();
  expect(screen.getByRole('switch')).toHaveProp('value', true);
  expect(save).toHaveBeenCalledTimes(1);
});
it.each(['success', 'failure'] as const)(
  'restarts an old settings read on reminder return and ignores its late %s',
  async (outcome) => {
    jest.useFakeTimers();
    const source = createSettingsMorning();
    const original = source.settings.loadMe;
    const old = await (() => {
      const result = original(new AbortController().signal);
      void jest.runAllTimersAsync();
      return result;
    })();
    let resolveOld!: (value: typeof old) => void,
      rejectOld!: (error: Error) => void;
    const pending = new Promise<typeof old>((resolve, reject) => {
      resolveOld = resolve;
      rejectOld = reject;
    });
    const load = jest.spyOn(source.settings, 'loadMe');
    load.mockImplementationOnce(original).mockImplementationOnce(() => pending);
    await render(
      <SettingsScreen actions={source.settings} onBack={() => {}} />,
    );
    await tick();
    await press('고민 기록 열기');
    await tick();
    await press('설정으로 돌아가기');
    const oldSignal = load.mock.calls[1][0];
    await press('밤에 와 알림 열기');
    await tick();
    await fireEvent(screen.getByRole('switch'), 'valueChange', true);
    await press('저장');
    await tick();
    await press('설정으로 돌아가기');
    await tick();
    expect(oldSignal.aborted).toBe(true);
    expect(screen.getByText('켜짐 · 23:00')).toBeTruthy();
    await act(async () => {
      if (outcome === 'success') resolveOld(old);
      else rejectOld(new Error('late'));
    });
    expect(screen.getByText('켜짐 · 23:00')).toBeTruthy();
    expect(screen.queryByText('설정 확인 필요')).toBeNull();
  },
);

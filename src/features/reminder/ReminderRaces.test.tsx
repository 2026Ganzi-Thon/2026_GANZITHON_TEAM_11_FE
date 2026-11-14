import { expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ReminderScreen } from './ReminderScreen';
import type { Reminder, ReminderActions } from './types';
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
function source(): ReminderActions {
  return {
    load: async () => ({ enabled: false, local_time: null }),
    save: async (target) => target,
    readPermission: async () => 'granted',
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}
it.each(['success', 'failure'] as const)(
  'cancels an old submission and ignores its late %s after a source change',
  async (outcome) => {
    const old = source(),
      next = source(),
      pending = deferred<Reminder>();
    next.load = async () => ({ enabled: true, local_time: '06:45' });
    const save = jest
      .fn<ReminderActions['save']>()
      .mockImplementation(() => pending.promise);
    old.save = save;
    const view = await render(
      <ReminderScreen actions={old} onBack={() => {}} />,
    );
    await screen.findByRole('switch');
    await fireEvent(screen.getByRole('switch'), 'valueChange', true);
    await press('저장');
    const signal = save.mock.calls[0][1];
    await view.rerender(<ReminderScreen actions={next} onBack={() => {}} />);
    await screen.findByRole('switch');
    expect(signal.aborted).toBe(true);
    await act(async () => {
      if (outcome === 'success')
        pending.resolve({ enabled: true, local_time: '23:00' });
      else pending.reject(new Error('late'));
    });
    expect(
      screen.getByRole('adjustable', { name: '알림 시' }),
    ).toHaveAccessibilityValue({ now: 6 });
    expect(
      screen.getByRole('adjustable', { name: '알림 분' }),
    ).toHaveAccessibilityValue({ now: 45 });
    expect(screen.queryByText('알림 희망 설정을 저장했어요.')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  },
);
it('aborts pending reads on close and ignores both old data and old permission', async () => {
  const actions = source(),
    data = deferred<Reminder>(),
    permission = deferred<'denied'>(),
    back = jest.fn();
  const load = jest
    .fn<ReminderActions['load']>()
    .mockImplementation(() => data.promise);
  const readPermission = jest
    .fn<ReminderActions['readPermission']>()
    .mockImplementation(() => permission.promise);
  actions.load = load;
  actions.readPermission = readPermission;
  await render(<ReminderScreen actions={actions} onBack={back} />);
  await press('알림 설정 닫기');
  expect(load.mock.calls[0][0].aborted).toBe(true);
  expect(readPermission.mock.calls[0][0].aborted).toBe(true);
  await act(async () => {
    data.resolve({ enabled: true, local_time: '23:00' });
    permission.resolve('denied');
  });
  expect(back).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('switch')).toBeNull();
  expect(screen.queryByText(/권한 필요/)).toBeNull();
});
it.each([
  null,
  { enabled: true, local_time: null },
  { enabled: false, local_time: '23:00' },
])('blocks editing for malformed saved state %p', async (value) => {
  const actions = source();
  actions.load = async () => value as Reminder;
  await render(<ReminderScreen actions={actions} onBack={() => {}} />);
  await screen.findByRole('button', { name: '알림 설정 다시 불러오기' });
  expect(screen.queryByRole('switch')).toBeNull();
});

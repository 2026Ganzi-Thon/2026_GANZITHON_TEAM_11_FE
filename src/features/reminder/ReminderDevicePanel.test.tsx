import { expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ReminderScreen } from './ReminderScreen';
import { createReminderConnection } from '../../notifications/connection';
import { createDeviceReminder } from '../../notifications/service';
import { fakeDevice } from '../../notifications/__tests__/fakeDevice';
import type { ReminderSetting } from '../../notifications/types';
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
function backend() {
  let saved: ReminderSetting = { enabled: false, local_time: null };
  return {
    load: async () => ({ ...saved }),
    save: jest.fn(async (value: ReminderSetting) => {
      saved = { ...value };
      return { ...saved };
    }),
  };
}
it('separates permission from the draft and shows an actual device reservation after saving', async () => {
  const account = backend(),
    { port, setPermission } = fakeDevice();
  setPermission({
    status: 'undetermined',
    canAskAgain: true,
    channel: 'missing',
  });
  const actions = createReminderConnection(account, createDeviceReminder(port));
  await render(<ReminderScreen actions={actions} onBack={() => {}} />);
  await screen.findByRole('button', { name: '알림 권한 요청' });
  await fireEvent(screen.getByRole('switch'), 'valueChange', true);
  port.requestPermission.mockImplementationOnce(async () => {
    setPermission({ status: 'granted', canAskAgain: true, channel: 'enabled' });
    return port.readPermission();
  });
  await press('알림 권한 요청');
  expect(await screen.findByText('기기 예약 · 꺼짐')).toBeTruthy();
  expect(port.schedule).not.toHaveBeenCalled();
  await press('저장');
  expect(await screen.findByText('알림 희망 설정을 저장했어요.')).toBeTruthy();
  expect(await screen.findByText('기기 예약 · 매일 23:00')).toBeTruthy();
  expect(screen.queryByText(/권한 상태도 예시/)).toBeNull();
});
it('shows device-only retry after a committed account write without submitting the preference again', async () => {
  const account = backend(),
    { port } = fakeDevice();
  const actions = createReminderConnection(account, createDeviceReminder(port));
  await render(<ReminderScreen actions={actions} onBack={() => {}} />);
  await screen.findByText('기기 예약 · 꺼짐');
  await fireEvent(screen.getByRole('switch'), 'valueChange', true);
  port.schedule.mockRejectedValueOnce(new Error('failure'));
  await press('저장');
  expect(await screen.findByText('알림 희망 설정을 저장했어요.')).toBeTruthy();
  await press('기기 상태 다시 확인');
  expect(await screen.findByText('기기 예약 · 매일 23:00')).toBeTruthy();
  expect(account.save).toHaveBeenCalledTimes(1);
});
it('offers system settings for permanent denial instead of another OS prompt', async () => {
  const account = backend(),
    { port, setPermission } = fakeDevice();
  setPermission({ status: 'denied', canAskAgain: false, channel: 'enabled' });
  const actions = createReminderConnection(account, createDeviceReminder(port));
  await render(<ReminderScreen actions={actions} onBack={() => {}} />);
  await screen.findByRole('button', { name: '기기 알림 설정 열기' });
  expect(screen.queryByRole('button', { name: '알림 권한 요청' })).toBeNull();
  await press('기기 알림 설정 열기');
  expect(port.openSettings).toHaveBeenCalledTimes(1);
  expect(port.requestPermission).not.toHaveBeenCalled();
});
it('unsubscribes an old device source so its late failure does not replace the current device status', async () => {
  const oldAccount = backend(),
    nextAccount = backend();
  const old = fakeDevice(),
    next = fakeDevice();
  let rejectOld!: (error: Error) => void;
  old.port.list.mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        rejectOld = reject;
      }),
  );
  const oldActions = createReminderConnection(
    oldAccount,
    createDeviceReminder(old.port),
  );
  const nextActions = createReminderConnection(
    nextAccount,
    createDeviceReminder(next.port),
  );
  const view = await render(
    <ReminderScreen actions={oldActions} onBack={() => {}} />,
  );
  await screen.findByRole('switch');
  await view.rerender(
    <ReminderScreen actions={nextActions} onBack={() => {}} />,
  );
  await screen.findByText('기기 예약 · 꺼짐');
  await act(async () => {
    rejectOld(new Error('late old source'));
  });
  expect(screen.getByText('기기 예약 · 꺼짐')).toBeTruthy();
  expect(screen.queryByText('기기 예약 상태를 확인하지 못했어요.')).toBeNull();
});

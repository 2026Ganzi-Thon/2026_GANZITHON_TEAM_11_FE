import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { ApiError } from '../../api/errors';
import { ReminderScreen } from './ReminderScreen';
import type { ReminderActions } from './types';
afterEach(() => {
  jest.restoreAllMocks();
});
const press = async (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
function source(): ReminderActions {
  return {
    load: jest
      .fn<ReminderActions['load']>()
      .mockResolvedValue({ enabled: false, local_time: null }),
    save: jest
      .fn<ReminderActions['save']>()
      .mockImplementation(async (target) => ({ ...target })),
    readPermission: jest
      .fn<ReminderActions['readPermission']>()
      .mockResolvedValue('denied'),
  };
}
const enable = async () =>
  fireEvent(
    screen.getByRole('switch', { name: '밤에 와 알림' }),
    'valueChange',
    true,
  );
const change = async (name: string, action: string = 'increment') =>
  fireEvent(screen.getByRole('adjustable', { name }), 'accessibilityAction', {
    nativeEvent: { actionName: action },
  });
it('saves the selected KST time independently of denied permission and never claims a scheduled notification', async () => {
  const actions = source();
  await render(<ReminderScreen actions={actions} onBack={() => {}} />);
  await screen.findByRole('switch');
  expect(screen.getByText(/기기 알림 권한 · 권한 필요/)).toBeTruthy();
  await enable();
  await change('알림 분');
  await press('저장');
  expect(await screen.findByText('알림 희망 설정을 저장했어요.')).toBeTruthy();
  expect(screen.getByText('켜짐 · 23:15')).toBeTruthy();
  expect(actions.save).toHaveBeenCalledWith(
    { enabled: true, local_time: '23:15' },
    expect.any(AbortSignal),
  );
  expect(screen.getByText(/실제 알림은 예약하지 않아요/)).toBeTruthy();
});
it('preserves the chosen time across off/on edits and sends null when saving off', async () => {
  const actions = source();
  actions.load = jest
    .fn<ReminderActions['load']>()
    .mockResolvedValue({ enabled: true, local_time: '00:45' });
  await render(<ReminderScreen actions={actions} onBack={() => {}} />);
  await screen.findByRole('switch');
  const toggle = () => screen.getByRole('switch');
  await fireEvent(toggle(), 'valueChange', false);
  expect(screen.getByRole('adjustable', { name: '알림 분' })).toBeDisabled();
  await fireEvent(toggle(), 'valueChange', true);
  expect(
    screen.getByRole('adjustable', { name: '알림 분' }),
  ).toHaveAccessibilityValue({ now: 45 });
  await fireEvent(toggle(), 'valueChange', false);
  await press('저장');
  await screen.findByText('알림 희망 설정을 저장했어요.');
  expect(actions.save).toHaveBeenCalledWith(
    { enabled: false, local_time: null },
    expect.any(AbortSignal),
  );
});
it('retains the draft on definite rejection and allows a corrected save', async () => {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
  const actions = source();
  (actions.save as jest.Mock<ReminderActions['save']>).mockRejectedValueOnce(
    new ApiError('http', { status: 422 }),
  );
  await render(<ReminderScreen actions={actions} onBack={() => {}} />);
  await screen.findByRole('switch');
  await enable();
  await change('알림 분');
  await press('저장');
  expect(await screen.findByRole('alert')).toHaveTextContent(
    /선택한 시간은 그대로예요/,
  );
  expect(
    screen.getByRole('adjustable', { name: '알림 분' }),
  ).toHaveAccessibilityValue({ now: 15 });
  await change('알림 분');
  await press('저장');
  await screen.findByText('알림 희망 설정을 저장했어요.');
  expect(actions.save).toHaveBeenLastCalledWith(
    { enabled: true, local_time: '23:30' },
    expect.any(AbortSignal),
  );
});
it('freezes an uncertain target and retries the identical operation before completing', async () => {
  const actions = source();
  (actions.save as jest.Mock<ReminderActions['save']>).mockRejectedValueOnce(
    new ApiError('network'),
  );
  await render(<ReminderScreen actions={actions} onBack={() => {}} />);
  await screen.findByRole('switch');
  await enable();
  await press('저장');
  expect(await screen.findByRole('alert')).toHaveTextContent(
    /저장 결과를 확인하지 못했어요/,
  );
  expect(screen.queryByRole('switch')).toBeNull();
  await press('같은 설정으로 다시 확인');
  await screen.findByText('알림 희망 설정을 저장했어요.');
  expect(actions.save).toHaveBeenCalledTimes(2);
  expect(actions.save).toHaveBeenNthCalledWith(
    2,
    { enabled: true, local_time: '23:00' },
    expect.any(AbortSignal),
  );
});
it('retries permission separately without losing a draft or resaving', async () => {
  const actions = source();
  (
    actions.readPermission as jest.Mock<ReminderActions['readPermission']>
  ).mockRejectedValueOnce(new Error('offline'));
  await render(<ReminderScreen actions={actions} onBack={() => {}} />);
  await screen.findByRole('switch');
  await enable();
  await change('알림 분');
  await press('권한 상태 다시 확인');
  expect(await screen.findByText(/기기 알림 권한 · 권한 필요/)).toBeTruthy();
  expect(
    screen.getByRole('adjustable', { name: '알림 분' }),
  ).toHaveAccessibilityValue({ now: 15 });
  expect(actions.save).not.toHaveBeenCalled();
  expect(actions.load).toHaveBeenCalledTimes(1);
});
it.each([
  { enabled: true, local_time: '23:01' },
  { enabled: false, local_time: '23:00' },
  { enabled: true, local_time: '22:00' },
])(
  'does not declare a mismatched or invalid save successful: %p',
  async (result) => {
    const actions = source();
    (actions.save as jest.Mock<ReminderActions['save']>).mockResolvedValue(
      result,
    );
    await render(<ReminderScreen actions={actions} onBack={() => {}} />);
    await screen.findByRole('switch');
    await enable();
    await press('저장');
    await screen.findByRole('button', { name: '같은 설정으로 다시 확인' });
    expect(screen.queryByText('알림 희망 설정을 저장했어요.')).toBeNull();
  },
);
it('retries a failed initial load without manufacturing a disabled default', async () => {
  const actions = source();
  (actions.load as jest.Mock<ReminderActions['load']>).mockRejectedValueOnce(
    new Error('fail'),
  );
  await render(<ReminderScreen actions={actions} onBack={() => {}} />);
  await screen.findByRole('button', { name: '알림 설정 다시 불러오기' });
  expect(screen.queryByRole('switch')).toBeNull();
  await press('알림 설정 다시 불러오기');
  expect(await screen.findByRole('switch')).toHaveProp('value', false);
});
it('blocks duplicate saves and modal back while saving', async () => {
  const actions = source(),
    back = jest.fn();
  let finish!: (value: { enabled: boolean; local_time: string | null }) => void;
  actions.save = jest.fn<ReminderActions['save']>().mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await render(<ReminderScreen modal actions={actions} onBack={back} />);
  await screen.findByRole('switch');
  await enable();
  await press('저장');
  expect(screen.getByRole('button', { name: '저장 중' })).toBeDisabled();
  expect(
    screen.getByRole('progressbar', { name: '알림 설정 저장 중' }),
  ).toBeTruthy();
  expect(screen.getByText('알림 설정을 저장하고 있어요.')).toBeTruthy();
  await fireEvent(screen.getByTestId('reminder-modal'), 'requestClose');
  expect(back).not.toHaveBeenCalled();
  expect(actions.save).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish({ enabled: true, local_time: '23:00' });
  });
  expect(
    screen.queryByRole('progressbar', { name: '알림 설정 저장 중' }),
  ).toBeNull();
  await press('설정으로 돌아가기');
  expect(back).toHaveBeenCalledTimes(1);
});

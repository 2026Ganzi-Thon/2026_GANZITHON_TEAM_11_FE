import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { WithdrawalDialog } from './WithdrawalDialog';
import { deferred } from '../../notifications/__tests__/fakeDevice';
import type { WithdrawalActions } from './types';
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
afterEach(() => {
  jest.restoreAllMocks();
});
it.each(['조금 더 있을래요', '탈퇴 확인 닫기', 'Android back'])(
  'cancels the confirmation without deleting an account: %s',
  async (action) => {
    const withdraw = jest.fn<WithdrawalActions['withdraw']>();
    const cancel = jest.fn();
    await render(
      <WithdrawalDialog
        actions={{ withdraw }}
        onCancel={cancel}
        onWithdrawn={() => {}}
      />,
    );
    if (action === 'Android back')
      await fireEvent(screen.getByTestId('withdrawal-modal'), 'requestClose');
    else await press(action);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(withdraw).not.toHaveBeenCalled();
  },
);
it('keeps pending feedback visible in the submit button and blocks duplicate submit and all exits', async () => {
  const pending = deferred<void>();
  const withdraw = jest.fn<WithdrawalActions['withdraw']>(
    () => pending.promise,
  );
  const cancel = jest.fn(),
    done = jest.fn();
  await render(
    <WithdrawalDialog
      actions={{ withdraw }}
      onCancel={cancel}
      onWithdrawn={done}
    />,
  );
  await press('탈퇴하기');
  expect(screen.getByRole('button', { name: '탈퇴 처리 중' })).toBeDisabled();
  await press('탈퇴 처리 중');
  await press('조금 더 있을래요');
  await press('탈퇴 확인 닫기');
  await fireEvent(screen.getByTestId('withdrawal-modal'), 'requestClose');
  expect(withdraw).toHaveBeenCalledTimes(1);
  expect(cancel).not.toHaveBeenCalled();
  await act(async () => pending.resolve());
  expect(done).toHaveBeenCalledTimes(1);
});
it('keeps a failed withdrawal open with a retry and does not expose private errors', async () => {
  const withdraw = jest
    .fn<WithdrawalActions['withdraw']>()
    .mockRejectedValueOnce(new Error('private server details'))
    .mockResolvedValue(undefined);
  const done = jest.fn();
  await render(
    <WithdrawalDialog
      actions={{ withdraw }}
      onCancel={() => {}}
      onWithdrawn={done}
    />,
  );
  await press('탈퇴하기');
  expect(
    screen.getByText(
      '탈퇴를 완료하지 못했어요. 계정 정리를 다시 확인해 주세요.',
    ),
  ).toBeTruthy();
  expect(screen.queryByText('private server details')).toBeNull();
  expect(done).not.toHaveBeenCalled();
  await press('다시 탈퇴하기');
  expect(done).toHaveBeenCalledTimes(1);
});
it.each(['success', 'failure'] as const)(
  'aborts the previous account request and ignores a late %s on source replacement',
  async (result) => {
    const pending = deferred<void>();
    const withdraw = jest.fn<WithdrawalActions['withdraw']>(
      () => pending.promise,
    );
    const oldDone = jest.fn(),
      newDone = jest.fn();
    await render(
      <WithdrawalDialog
        actions={{ withdraw }}
        onCancel={() => {}}
        onWithdrawn={oldDone}
      />,
    );
    await press('탈퇴하기');
    await screen.rerender(
      <WithdrawalDialog
        actions={{ withdraw: async () => {} }}
        onCancel={() => {}}
        onWithdrawn={newDone}
      />,
    );
    expect(withdraw.mock.calls[0][0].aborted).toBe(true);
    await act(async () =>
      result === 'success'
        ? pending.resolve()
        : pending.reject(new Error('late')),
    );
    expect(oldDone).not.toHaveBeenCalled();
    expect(newDone).not.toHaveBeenCalled();
    expect(screen.queryByText(/탈퇴를 완료하지/)).toBeNull();
    expect(screen.getByRole('button', { name: '탈퇴하기' })).not.toBeDisabled();
  },
);

import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { LogoutDialog } from './LogoutDialog';
import type { LogoutActions } from './logout';
import { deferred } from '../../notifications/__tests__/fakeDevice';
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
afterEach(() => {
  jest.restoreAllMocks();
});
it.each(['계속 있을게요', 'Android back'])(
  'cancels without signing out: %s',
  async (action) => {
    const logout = jest.fn<LogoutActions['logout']>(),
      cancel = jest.fn();
    await render(<LogoutDialog actions={{ logout }} onCancel={cancel} />);
    if (action === 'Android back')
      await fireEvent(screen.getByTestId('logout-modal'), 'requestClose');
    else await press(action);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(logout).not.toHaveBeenCalled();
  },
);
it('shows progress at the action, prevents duplicate submits and exits, then retries a failure', async () => {
  const pending = deferred<void>();
  const logout = jest
    .fn<LogoutActions['logout']>()
    .mockImplementationOnce(() => pending.promise)
    .mockResolvedValue(undefined);
  const cancel = jest.fn();
  await render(<LogoutDialog actions={{ logout }} onCancel={cancel} />);
  await press('로그아웃');
  expect(screen.getByRole('button', { name: '로그아웃 중' })).toBeDisabled();
  await press('로그아웃 중');
  await press('계속 있을게요');
  await fireEvent(screen.getByTestId('logout-modal'), 'requestClose');
  expect(logout).toHaveBeenCalledTimes(1);
  expect(cancel).not.toHaveBeenCalled();
  await act(async () => pending.reject(new Error('private internal error')));
  expect(screen.getByRole('alert')).toHaveTextContent(
    /로그아웃을 완료하지 못했어요/,
  );
  expect(screen.queryByText('private internal error')).toBeNull();
  await press('다시 로그아웃');
  expect(logout).toHaveBeenCalledTimes(2);
});
it.each(['success', 'failure'] as const)(
  'aborts on source replacement and ignores late %s',
  async (outcome) => {
    const pending = deferred<void>(),
      logout = jest.fn<LogoutActions['logout']>(() => pending.promise);
    const next = jest
      .fn<LogoutActions['logout']>()
      .mockResolvedValue(undefined);
    await render(<LogoutDialog actions={{ logout }} onCancel={() => {}} />);
    await press('로그아웃');
    await screen.rerender(
      <LogoutDialog actions={{ logout: next }} onCancel={() => {}} />,
    );
    expect(logout.mock.calls[0][0].aborted).toBe(true);
    await act(async () =>
      outcome === 'success'
        ? pending.resolve()
        : pending.reject(new Error('late')),
    );
    expect(screen.getByRole('button', { name: '로그아웃' })).toBeEnabled();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(next).not.toHaveBeenCalled();
  },
);

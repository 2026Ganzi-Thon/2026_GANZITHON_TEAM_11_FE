import { expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SettingsScreen } from './SettingsScreen';
import type { SettingsActions, SettingsData } from './types';
const data: SettingsData = {
  user: {
    id: 'u',
    email: 'person@example.com',
    birth_date: null,
    birth_date_edits_remaining: 1,
    stats: { night_count: 66, counted_sheep_total: 658, worry_record_count: 3 },
  },
  reminder: { enabled: false, local_time: null },
};
const source = (): SettingsActions => ({
  loadMe: async () => data,
  worries: { load: async () => ({ items: [], next_cursor: null }) },
});
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
it('retries failed settings reads and keeps unfinished account actions disabled', async () => {
  const actions = source();
  actions.loadMe = jest
    .fn<SettingsActions['loadMe']>()
    .mockRejectedValueOnce(new Error('private server detail'))
    .mockResolvedValue(data);
  await render(<SettingsScreen actions={actions} onBack={() => {}} />);
  expect(screen.getByText('설정을 불러오지 못했어요.')).toBeTruthy();
  expect(screen.queryByText('private server detail')).toBeNull();
  await press('설정 다시 불러오기');
  expect(screen.getByText('66밤째 양을 세는 중')).toBeTruthy();
  for (const label of [
    '밤에 와 알림',
    '생년월일',
    '로그인 정보',
    '약관 · 개인정보',
    '탈퇴',
  ])
    expect(
      screen.getByRole('button', { name: label + ' · 준비 중' }),
    ).toBeDisabled();
});
it('turns an empty successful profile response into a retryable failure', async () => {
  const actions = source();
  actions.loadMe = async () => undefined as never;
  await render(<SettingsScreen actions={actions} onBack={() => {}} />);
  expect(screen.getByText('설정을 불러오지 못했어요.')).toBeTruthy();
});
it.each(['success', 'failure'] as const)(
  'aborts a previous source and ignores its late %s',
  async (mode) => {
    let finish!: (value: SettingsData) => void;
    let fail!: (error: Error) => void;
    const old = source();
    const load = jest.fn<SettingsActions['loadMe']>().mockImplementation(
      () =>
        new Promise((r, j) => {
          finish = r;
          fail = j;
        }),
    );
    old.loadMe = load;
    await render(<SettingsScreen actions={old} onBack={() => {}} />);
    const next = source();
    next.loadMe = async () => ({
      ...data,
      user: { ...data.user, id: 'next', email: 'next@example.com' },
    });
    await screen.rerender(<SettingsScreen actions={next} onBack={() => {}} />);
    expect(load.mock.calls[0][0].aborted).toBe(true);
    await act(async () => {
      if (mode === 'success') finish(data);
      else fail(new Error('late'));
    });
    expect(screen.getByText('next@example.com')).toBeTruthy();
    expect(screen.queryByText('person@example.com')).toBeNull();
    expect(screen.queryByText('설정을 불러오지 못했어요.')).toBeNull();
  },
);
it('closes the list before closing the settings modal on Android back', async () => {
  const actions = source();
  const back = jest.fn();
  await render(<SettingsScreen modal actions={actions} onBack={back} />);
  await press('고민 기록 열기');
  expect(screen.getByText('저장된 고민 없음')).toBeTruthy();
  await fireEvent(screen.getByTestId('settings-modal'), 'requestClose');
  expect(screen.getByRole('button', { name: '고민 기록 열기' })).toBeTruthy();
  expect(back).not.toHaveBeenCalled();
  await fireEvent(screen.getByTestId('settings-modal'), 'requestClose');
  expect(back).toHaveBeenCalledTimes(1);
});

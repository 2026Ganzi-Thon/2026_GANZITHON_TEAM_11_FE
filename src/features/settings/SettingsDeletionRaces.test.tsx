import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SettingsScreen } from './SettingsScreen';
import { createSettingsMorning } from '../../mocks/settingsMorning';
import {
  createWorryDeletions,
  type WorryDeletionActions,
} from '../worries/deletions';
import type { SettingsActions, SettingsData, WorryPage } from './types';
const tick = () =>
  act(async () => {
    await jest.runAllTimersAsync();
  });
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
const snapshot = (count: number): SettingsData => ({
  user: {
    id: 'settings-user',
    email: 'yang@example.com',
    birth_date: null,
    birth_date_edits_remaining: 1,
    stats: {
      night_count: 66,
      counted_sheep_total: 658,
      worry_record_count: count,
    },
  },
  reminder: { enabled: false, local_time: null },
});
afterEach(() => {
  jest.useRealTimers();
});
async function open(actions: SettingsActions) {
  await render(<SettingsScreen actions={actions} onBack={() => {}} />);
  await tick();
  await press('고민 기록 열기');
  await tick();
}
async function remove(date = '2026-11-10') {
  await press(date + ' 고민 삭제');
  await press('지우기');
  await tick();
}
it('does not restore an old count when another deletion invalidates a pending profile refresh', async () => {
  jest.useFakeTimers();
  const source = createSettingsMorning();
  const original = source.settings.loadMe;
  let finish!: (data: SettingsData) => void;
  const loadMe = jest
    .fn<SettingsActions['loadMe']>()
    .mockImplementationOnce(original)
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          finish = r;
        }),
    )
    .mockImplementation(original);
  source.settings.loadMe = loadMe;
  await open(source.settings);
  await remove();
  expect(screen.getByText('기록 개수를 확인하고 있어요.')).toBeTruthy();
  expect(screen.queryByText('고민 기록 3개')).toBeNull();
  await remove('2026-11-09');
  expect(loadMe.mock.calls[1][0].aborted).toBe(true);
  expect(screen.getByText('고민 기록 1개')).toBeTruthy();
  await act(async () => finish(snapshot(2)));
  expect(screen.getByText('고민 기록 1개')).toBeTruthy();
  expect(screen.queryByText('고민 기록 2개')).toBeNull();
});
it('aborts an in-flight more page, reloads a fresh first page and ignores late deleted originals', async () => {
  jest.useFakeTimers();
  const source = createSettingsMorning('paged');
  const original = source.settings.worries.load;
  let finish!: (page: WorryPage) => void;
  const load = jest
    .fn<SettingsActions['worries']['load']>()
    .mockImplementationOnce(original)
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          finish = r;
        }),
    )
    .mockImplementation(original);
  source.settings.worries.load = load;
  await open(source.settings);
  await press('더 보기');
  await remove();
  expect(load.mock.calls[1][1].aborted).toBe(true);
  expect(load.mock.calls[2][0]).toEqual({});
  await act(async () =>
    finish({
      items: [
        {
          night_id: 'preview-night',
          night_date: '2026-11-10',
          category_id: 'career',
          worry_text: '부활하면 안 되는 원문',
          reflection: null,
        },
      ],
      next_cursor: null,
    }),
  );
  expect(screen.queryByText('부활하면 안 되는 원문')).toBeNull();
  expect(
    screen.queryByRole('button', { name: '2026-11-10 고민 삭제' }),
  ).toBeNull();
  expect(screen.getByText('시험을 앞두고 마음이 복잡해요.')).toBeTruthy();
  expect(screen.getByText('고민 기록 2개')).toBeTruthy();
});
it('filters a stale replacement page against confirmed deletion IDs', async () => {
  jest.useFakeTimers();
  const source = createSettingsMorning();
  const original = source.settings.worries.load;
  const old = original({}, new AbortController().signal);
  await tick();
  const page = await old;
  source.settings.worries.load = jest
    .fn<SettingsActions['worries']['load']>()
    .mockImplementationOnce(original)
    .mockResolvedValue(page);
  await open(source.settings);
  await remove();
  expect(
    screen.queryByRole('button', { name: '2026-11-10 고민 삭제' }),
  ).toBeNull();
  expect(
    screen.queryByText('면접 결과가 내일 나오는데 계속 생각나서 잠이 안 와요.'),
  ).toBeNull();
  expect(screen.getByText('연락이 뜸해진 게 자꾸 신경 쓰여요.')).toBeTruthy();
});
it.each(['success', 'failure'] as const)(
  'aborts pending deletion on source replacement and ignores late %s for the old account',
  async (mode) => {
    jest.useFakeTimers();
    let finish!: () => void;
    let fail!: (error: Error) => void;
    const removeAction = jest
      .fn<WorryDeletionActions['remove']>()
      .mockImplementation(
        () =>
          new Promise<void>((r, j) => {
            finish = r;
            fail = j;
          }),
      );
    const old = createSettingsMorning();
    const deletion = createWorryDeletions({ remove: removeAction });
    old.settings.deletions = deletion;
    await open(old.settings);
    await press('2026-11-10 고민 삭제');
    await press('지우기');
    const next = createSettingsMorning();
    await screen.rerender(
      <SettingsScreen actions={next.settings} onBack={() => {}} />,
    );
    expect(removeAction.mock.calls[0][1].aborted).toBe(true);
    await act(async () => {
      if (mode === 'success') finish();
      else fail(new Error('late private error'));
    });
    await tick();
    expect(screen.queryByTestId('worry-delete-modal')).toBeNull();
    expect(deletion.isDeleted('preview-night')).toBe(false);
    expect(next.worries!.isDeleted('preview-night')).toBe(false);
    await press('고민 기록 열기');
    await tick();
    expect(screen.getByText('고민 기록 3개')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: '2026-11-10 고민 삭제' }),
    ).toBeTruthy();
    expect(screen.queryByText('late private error')).toBeNull();
  },
);
it.each(['success', 'failure'] as const)(
  'refreshes the latest count after a lost deletion when an older profile read has a late %s',
  async (mode) => {
    jest.useFakeTimers();
    const source = createSettingsMorning('delete-lost');
    const original = source.settings.loadMe;
    let finish!: (data: SettingsData) => void;
    let fail!: (error: Error) => void;
    const loadMe = jest
      .fn<SettingsActions['loadMe']>()
      .mockImplementationOnce(original)
      .mockImplementationOnce(
        () =>
          new Promise((resolve, reject) => {
            finish = resolve;
            fail = reject;
          }),
      )
      .mockImplementation(original);
    source.settings.loadMe = loadMe;
    await open(source.settings);
    await press('설정으로 돌아가기');
    expect(screen.getByText('기록 개수를 확인하고 있어요.')).toBeTruthy();
    expect(loadMe).toHaveBeenCalledTimes(2);
    await press('고민 기록 열기');
    await tick();
    await remove();
    expect(screen.getByText('삭제 결과를 확인하지 못했어요')).toBeTruthy();
    await press('취소');
    await press('설정으로 돌아가기');
    await tick();
    await act(async () => {
      if (mode === 'success') finish(snapshot(3));
      else fail(new Error('late profile failure'));
    });
    expect(screen.getByText('2개')).toBeTruthy();
    expect(screen.queryByText('3개')).toBeNull();
    expect(screen.queryByText('기록 개수를 확인하지 못했어요.')).toBeNull();
    expect(loadMe.mock.calls[1][0].aborted).toBe(true);
    expect(loadMe).toHaveBeenCalledTimes(3);
    const actual = original(new AbortController().signal);
    await tick();
    expect((await actual).user.stats.worry_record_count).toBe(2);
    await press('고민 기록 열기');
    await tick();
    expect(screen.getByText('고민 기록 2개')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: '2026-11-10 고민 삭제' }),
    ).toBeNull();
  },
);

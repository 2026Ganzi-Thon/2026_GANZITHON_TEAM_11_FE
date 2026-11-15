import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, render, screen, fireEvent } from '@testing-library/react-native';
import { SettingsScreen } from './SettingsScreen';
import { createSettingsMorning } from '../../mocks/settingsMorning';
const tick = () =>
  act(async () => {
    await jest.runAllTimersAsync();
  });
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
const select = (date: string) =>
  fireEvent.press(screen.getByRole('checkbox', { name: date + ' 고민 선택' }));
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});
it('confirms a frozen selection, cancels without deleting, then removes originals and replies together', async () => {
  const source = createSettingsMorning();
  await render(<SettingsScreen actions={source.settings} onBack={() => {}} />);
  await tick();
  await press('고민 기록 열기');
  await tick();
  expect(
    screen.getByRole('button', { name: '선택한 0개 지우기' }),
  ).toBeDisabled();
  await select('2026-11-10');
  await select('2026-11-09');
  await press('선택한 2개 지우기');
  expect(
    screen.getByText('선택한 고민 2개와 돌아보기 답을 지울까요?'),
  ).toBeTruthy();
  await press('그냥 둘게요');
  expect(source.worries!.isDeleted('preview-night')).toBe(false);
  await press('선택한 2개 지우기');
  await press('지울게요');
  await tick();
  expect(screen.getByText('고민을 지웠어요')).toBeTruthy();
  const detail = source.loadSheep(
    'preview-adopted',
    new AbortController().signal,
  );
  const reflection = source.reflection.load(
    'preview-night',
    new AbortController().signal,
  );
  await tick();
  expect((await reflection).reflection).toBeNull();
  expect((await reflection).night!.worry_text).toBeNull();
  // The corresponding sheep and its card remain addressable after deletion.
  expect((await detail).sheep.id).toBe('preview-adopted');
  expect((await detail).night.reflection).toBeNull();
  expect((await detail).card.id).toBe('preview-song');
  await press('설정으로 돌아가기');
  await tick();
  expect(screen.getByText('1개')).toBeTruthy();
});
it('retains unknown results through settings return and resolves them by lookup without another deletion', async () => {
  const source = createSettingsMorning('delete-check-retry'),
    remove = jest.spyOn(source.worries!.records!, 'remove');
  await render(<SettingsScreen actions={source.settings} onBack={() => {}} />);
  await tick();
  await press('고민 기록 열기');
  await tick();
  await select('2026-11-10');
  await press('선택한 1개 지우기');
  await press('지울게요');
  await tick();
  expect(screen.getByText(/확인 필요 1개/)).toBeTruthy();
  await press('그냥 둘게요');
  await press('설정으로 돌아가기');
  await tick();
  await press('고민 기록 열기');
  await tick();
  await press('삭제 결과 다시 확인');
  await press('삭제 결과 다시 확인');
  await tick();
  expect(remove).toHaveBeenCalledTimes(1);
  expect(source.worries!.records!.isDeleted('preview-night')).toBe(true);
});
it('handles partial success and retries only remaining records', async () => {
  const source = createSettingsMorning('delete-partial'),
    remove = jest.spyOn(source.worries!.records!, 'remove');
  await render(<SettingsScreen actions={source.settings} onBack={() => {}} />);
  await tick();
  await press('고민 기록 열기');
  await tick();
  await press('전체 선택');
  await press('선택한 3개 지우기');
  await press('지울게요');
  await tick();
  expect(screen.getByText(/삭제 완료 2개/)).toBeTruthy();
  await press('미완료 항목 다시 처리');
  await tick();
  expect(remove.mock.calls.map((x) => x[0])).toEqual([
    'preview-night',
    'preview-earlier-0',
    'preview-earlier-1',
    'preview-earlier-0',
  ]);
  expect(screen.getByText('저장된 고민 없음')).toBeTruthy();
});
it('isolates selection and late deletion completion when the account source is replaced', async () => {
  const old = createSettingsMorning();
  let finish!: () => void;
  const remove = jest
    .spyOn(old.worries!.records!, 'remove')
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
  await render(<SettingsScreen actions={old.settings} onBack={() => {}} />);
  await tick();
  await press('고민 기록 열기');
  await tick();
  await select('2026-11-10');
  await press('선택한 1개 지우기');
  await press('지울게요');
  const next = createSettingsMorning();
  await screen.rerender(
    <SettingsScreen actions={next.settings} onBack={() => {}} />,
  );
  expect(remove.mock.calls[0][1].aborted).toBe(true);
  await act(async () => finish());
  await tick();
  await press('고민 기록 열기');
  await tick();
  expect(
    screen.getByRole('button', { name: '선택한 0개 지우기' }),
  ).toBeDisabled();
  expect(screen.getByText('고민 기록 3개')).toBeTruthy();
  expect(screen.queryByText('고민을 지웠어요')).toBeNull();
  expect(next.worries!.records!.isDeleted('preview-night')).toBe(false);
});
it('keeps selected IDs when loading another page and clears them only on explicit deselection', async () => {
  const source = createSettingsMorning('paged');
  await render(<SettingsScreen actions={source.settings} onBack={() => {}} />);
  await tick();
  await press('고민 기록 열기');
  await tick();
  await select('2026-11-10');
  await press('더 보기');
  await tick();
  expect(
    screen.getByRole('checkbox', { name: '2026-11-10 고민 선택' }),
  ).toBeChecked();
  expect(
    screen.getByRole('button', { name: '선택한 1개 지우기' }),
  ).toBeEnabled();
  await press('전체 선택');
  expect(
    screen.getByRole('button', { name: '선택한 3개 지우기' }),
  ).toBeEnabled();
  await press('전체 선택 해제');
  expect(
    screen.getByRole('button', { name: '선택한 0개 지우기' }),
  ).toBeDisabled();
});

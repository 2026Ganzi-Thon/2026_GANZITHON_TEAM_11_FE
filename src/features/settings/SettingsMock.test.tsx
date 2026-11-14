import { expect, it, jest, afterEach } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SettingsScreen } from './SettingsScreen';
import { createMockSettings } from '../../mocks/settings';
const tick = () =>
  act(async () => {
    await jest.runAllTimersAsync();
  });
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
afterEach(() => {
  jest.useRealTimers();
});
it('provides only surviving originals in date order and uses the full count across pages', async () => {
  jest.useFakeTimers();
  const actions = createMockSettings('paged');
  await render(<SettingsScreen actions={actions} onBack={() => {}} />);
  await tick();
  expect(screen.getByText('3개')).toBeTruthy();
  await press('고민 기록 열기');
  await tick();
  expect(screen.getByText('고민 기록 3개')).toBeTruthy();
  expect(
    screen.getAllByText(/2026-11-\d+ 밤/).map((n) => n.props.children),
  ).toEqual([
    ['2026-11-10', ' 밤'],
    ['2026-11-09', ' 밤'],
  ]);
  await press('더 보기');
  await tick();
  expect(screen.getByText('시험을 앞두고 마음이 복잡해요.')).toBeTruthy();
  expect(screen.queryByText('고민 없음')).toBeNull();
  expect(screen.queryByText('2026-11-06 밤')).toBeNull();
  expect(screen.queryByText('원문 없이 남은 회고')).toBeNull();
  expect(screen.queryByRole('button', { name: '더 보기' })).toBeNull();
});
it('reopens an unchanged source without deleting records and keeps long originals readable', async () => {
  jest.useFakeTimers();
  const actions = createMockSettings('long');
  await render(<SettingsScreen actions={actions} onBack={() => {}} />);
  await tick();
  await press('고민 기록 열기');
  await tick();
  expect(
    screen.getByText('내일의 일을 생각하느라 잠이 오지 않아요. '.repeat(15)),
  ).toBeTruthy();
  await press('설정으로 돌아가기');
  await press('고민 기록 열기');
  await tick();
  expect(screen.getByText('고민 기록 3개')).toBeTruthy();
  expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
});
it('aborts mock reads and releases their timer and listener', async () => {
  jest.useFakeTimers();
  const source = createMockSettings('slow');
  const controller = new AbortController();
  const cleanup = jest.spyOn(controller.signal, 'removeEventListener');
  const pending = source.worries.load({}, controller.signal);
  const rejected = expect(pending).rejects.toMatchObject({ kind: 'aborted' });
  controller.abort();
  await rejected;
  expect(jest.getTimerCount()).toBe(0);
  expect(cleanup).toHaveBeenCalledWith('abort', expect.any(Function));
});

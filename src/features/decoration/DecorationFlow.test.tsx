import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { MorningScreen } from '../morning/MorningScreen';
import { createMockMorning } from '../../mocks/morning';
const tick = () =>
  act(async () => {
    await jest.runAllTimersAsync();
  });
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
afterEach(() => {
  jest.useRealTimers();
});
it('saves one sheep from the flock and restores only that sheep on editor and home reentry', async () => {
  jest.useFakeTimers();
  const source = createMockMorning('existing');
  await render(<MorningScreen actions={source} onExit={() => {}} />);
  await tick();
  await press('양 꾸미기');
  await press('2026-11-10의 양 꾸미기');
  await tick();
  await press('별 스티커 붙이기');
  await press('오른쪽으로 이동');
  await press('저장');
  await tick();
  expect(screen.getByText('꾸미기를 저장했어요.')).toBeTruthy();
  expect(screen.getByLabelText('2026-11-10의 양 · 스티커 1개')).toBeTruthy();
  await press('양 꾸미기');
  await press('2026-11-10의 양 꾸미기');
  await tick();
  expect(screen.getByRole('button', { name: '붙인 별 1 선택' })).toBeTruthy();
  await press('꾸미기 닫기');
  await press('2026-11-09의 양 꾸미기');
  await tick();
  expect(screen.queryByRole('button', { name: /붙인 별/ })).toBeNull();
  await press('꾸미기 닫기');
  await press('양 선택 닫기');
  await screen.unmount();
  await render(<MorningScreen actions={source} onExit={() => {}} />);
  await tick();
  expect(screen.getByLabelText('2026-11-10의 양 · 스티커 1개')).toBeTruthy();
});
it('hides decoration entry on an empty flock and does not turn load errors into an empty state', async () => {
  jest.useFakeTimers();
  await render(
    <MorningScreen
      actions={createMockMorning('empty')}
      homeWhenNoCandidates
      onExit={() => {}}
    />,
  );
  await tick();
  expect(screen.getByText('아직 양떼가 비어 있어요')).toBeTruthy();
  expect(screen.queryByRole('button', { name: '양 꾸미기' })).toBeNull();
});

it('does not let a late older flock response replace the freshly saved adopted sheep', async () => {
  jest.useFakeTimers();
  const source = createMockMorning('existing');
  const read = source.loadMorning(new AbortController().signal);
  await tick();
  const adopted = (await read).adoption!;
  let reply!: (items: (typeof adopted)[]) => void;
  const delayed = new Promise<(typeof adopted)[]>((resolve) => {
    reply = resolve;
  });
  const actions = { ...source, loadFlock: () => delayed };
  await render(<MorningScreen actions={actions} onExit={() => {}} />);
  await tick();
  await press('양 꾸미기');
  await press('2026-11-10의 양 꾸미기');
  await tick();
  await press('별 스티커 붙이기');
  await press('저장');
  await tick();
  await act(async () => reply([{ ...adopted, version: 1, placements: [] }]));
  expect(screen.getByLabelText('2026-11-10의 양 · 스티커 1개')).toBeTruthy();
});

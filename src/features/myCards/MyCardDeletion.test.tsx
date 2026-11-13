import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createMockMyCards, type MyCardsScenario } from '../../mocks/myCards';
import { MyCardsScreen } from './MyCardsScreen';
const tick = () =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(400);
  });
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
async function open(scenario: MyCardsScenario = 'success') {
  jest.useFakeTimers();
  const actions = createMockMyCards(scenario);
  const remove = jest.spyOn(actions, 'remove'),
    load = jest.spyOn(actions, 'load');
  const view = await render(
    <MyCardsScreen actions={actions} deletions={actions} onBack={() => {}} />,
  );
  await tick();
  return { ...view, remove, load, actions };
}
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});
it.each([
  [
    'my-text-1',
    '나도 결과 기다리는 밤이 제일 길었어. 오늘은 잠깐 쉬어 가도 괜찮아.',
  ],
  ['my-song-2', '밤편지 · 아이유'],
  [
    'my-text-3',
    '나도 결과 기다리는 밤이 제일 길었어. 궁금하면 함께 이야기해요.',
  ],
])(
  'deletes %s only after confirmation and keeps it absent when changing filters',
  async (id, title) => {
    const { remove } = await open();
    await fireEvent.press(
      screen.getByRole('button', { name: `카드 삭제: ${title}` }),
    );
    expect(screen.getByText('이 카드를 지울까요?')).toBeTruthy();
    await press('취소');
    expect(remove).not.toHaveBeenCalled();
    expect(screen.getByText(title)).toBeTruthy();
    await fireEvent.press(
      screen.getByRole('button', { name: `카드 삭제: ${title}` }),
    );
    await press('지우기');
    await tick();
    await tick();
    expect(remove).toHaveBeenCalledWith(id, expect.any(AbortSignal));
    expect(screen.queryByText(title)).toBeNull();
    await fireEvent.press(screen.getByRole('tab', { name: '검수 중' }));
    await tick();
    await fireEvent.press(screen.getByRole('tab', { name: '전체' }));
    await tick();
    expect(screen.queryByText(title)).toBeNull();
  },
);
it('retains a failed deletion and retries, then reloads pages without skipping the next record', async () => {
  const { remove, load } = await open('delete-retry');
  await fireEvent.press(
    screen.getAllByRole('button', { name: /^카드 삭제:/ })[0],
  );
  await press('지우기');
  await tick();
  expect(screen.getByText('삭제 결과를 확인하지 못했어요')).toBeTruthy();
  await press('다시 지우기');
  await tick();
  await tick();
  expect(remove).toHaveBeenCalledTimes(2);
  expect(screen.getByText('내 속도로 걸어도 괜찮아요.')).toBeTruthy();
  await press('더 불러오기');
  await tick();
  expect(screen.getByText('쉬어 가는 밤 · 예시 가수')).toBeTruthy();
  expect(load.mock.calls.map(([query]) => query)).toEqual([
    {},
    {},
    { cursor: '3' },
  ]);
});
it('shows a true empty state after the last deletion and keeps it empty on revisit', async () => {
  await open('single');
  await fireEvent.press(
    screen.getAllByRole('button', { name: /^카드 삭제:/ })[0],
  );
  await press('지우기');
  await tick();
  expect(screen.queryByText('아직 쓴 카드가 없어요')).toBeNull();
  await tick();
  expect(screen.getByText('아직 쓴 카드가 없어요')).toBeTruthy();
  await fireEvent.press(screen.getByRole('tab', { name: '반려' }));
  await tick();
  await fireEvent.press(screen.getByRole('tab', { name: '전체' }));
  await tick();
  expect(screen.getByText('아직 쓴 카드가 없어요')).toBeTruthy();
});
it('keeps remaining rows after post-delete refresh failure and retries the list instead of deleting twice', async () => {
  const { remove } = await open('delete-refresh-retry');
  await fireEvent.press(
    screen.getAllByRole('button', { name: /^카드 삭제:/ })[0],
  );
  await press('지우기');
  await tick();
  await tick();
  expect(screen.getByText('목록을 다시 확인하지 못했어요')).toBeTruthy();
  expect(screen.getByText('밤편지 · 아이유')).toBeTruthy();
  await press('목록 다시 확인');
  await tick();
  expect(screen.queryByText('11/7 · 털실 12개')).toBeNull();
  expect(screen.getByText('내 속도로 걸어도 괜찮아요.')).toBeTruthy();
  expect(remove).toHaveBeenCalledTimes(1);
});
it('closes an old source dialog, aborts its request and ignores a late success after account replacement', async () => {
  const { remove, rerender } = await open();
  let resolve!: () => void;
  remove.mockReturnValueOnce(
    new Promise<void>((yes) => {
      resolve = yes;
    }),
  );
  await fireEvent.press(
    screen.getAllByRole('button', { name: /^카드 삭제:/ })[0],
  );
  await press('지우기');
  const next = createMockMyCards('single');
  await rerender(
    <MyCardsScreen actions={next} deletions={next} onBack={() => {}} />,
  );
  expect(remove.mock.calls[0][1].aborted).toBe(true);
  expect(screen.queryByText('이 카드를 지울까요?')).toBeNull();
  await tick();
  await act(async () => resolve());
  expect(screen.getByText('11/7 · 털실 12개')).toBeTruthy();
  expect(screen.queryByText('아직 쓴 카드가 없어요')).toBeNull();
});

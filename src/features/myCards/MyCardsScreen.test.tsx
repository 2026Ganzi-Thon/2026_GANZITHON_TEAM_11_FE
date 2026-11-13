import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createMockMyCards, type MyCardsScenario } from '../../mocks/myCards';
import { MyCardsScreen } from './MyCardsScreen';

const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
const tab = (name: string) =>
  fireEvent.press(screen.getByRole('tab', { name }));
const tick = () =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(400);
  });
async function open(scenario: MyCardsScenario = 'success') {
  jest.useFakeTimers();
  const actions = createMockMyCards(scenario),
    load = jest.spyOn(actions, 'load');
  const onBack = jest.fn();
  const view = await render(
    <MyCardsScreen actions={actions} onBack={onBack} />,
  );
  return { load, onBack, ...view };
}
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});
it('shows kind, date, confirmed yarn count, all statuses and read-only rejection reason', async () => {
  await open();
  expect(screen.getByText('카드를 불러오고 있어요')).toBeTruthy();
  await tick();
  for (const label of [
    '게시됨',
    '반려됨',
    '밤편지 · 아이유',
    '11/7 · 털실 12개',
    '반려 사유',
  ])
    expect(screen.getByText(label)).toBeTruthy();
  expect(screen.getByText(/개인 연락을 유도하는 문장을 빼고/)).toBeTruthy();
  expect(
    screen.queryByRole('button', { name: /삭제|고쳐서 다시 내기|재제출/ }),
  ).toBeNull();
  expect(
    screen.getByRole('button', { name: '카드 쓰기 · 준비 중' }),
  ).toBeDisabled();
  expect(screen.getByRole('tab', { name: '전체' })).toBeSelected();
});
it('filters pending and rejected records and resets page state for each tab', async () => {
  const { load } = await open();
  await tick();
  await tab('검수 중');
  expect(screen.queryByText('11/7 · 털실 12개')).toBeNull();
  await tick();
  expect(screen.getByText('밤편지 · 아이유')).toBeTruthy();
  expect(screen.getByText('내 속도로 걸어도 괜찮아요.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: '더 불러오기' })).toBeNull();
  await tab('반려');
  await tick();
  expect(screen.getByText('반려 사유')).toBeTruthy();
  expect(screen.queryByText('밤편지 · 아이유')).toBeNull();
  await tab('전체');
  await tick();
  expect(load.mock.calls.map(([query]) => query)).toEqual([
    {},
    { status: 'pending' },
    { status: 'rejected' },
    {},
  ]);
  expect(screen.getByRole('button', { name: '더 불러오기' })).toBeTruthy();
});
it('retries initial failure and preserves visible records when another page fails', async () => {
  const first = await open('load-retry');
  await tick();
  expect(screen.getByText('카드 목록을 불러오지 못했어요')).toBeTruthy();
  await press('다시 불러오기');
  await tick();
  expect(screen.getByText('게시됨')).toBeTruthy();
  await first.unmount();
  const { load } = await open('more-retry');
  await tick();
  await press('더 불러오기');
  expect(screen.getByRole('button', { name: '더 불러오는 중' })).toBeDisabled();
  await tick();
  expect(screen.getByText('추가 카드를 불러오지 못했어요')).toBeTruthy();
  expect(screen.getByText('11/7 · 털실 12개')).toBeTruthy();
  await press('추가 목록 다시 불러오기');
  await tick();
  expect(screen.getByText('내 속도로 걸어도 괜찮아요.')).toBeTruthy();
  expect(screen.getByText('쉬어 가는 밤 · 예시 가수')).toBeTruthy();
  expect(screen.getAllByText('11/7 · 털실 12개')).toHaveLength(1);
  expect(load.mock.calls.map(([query]) => query)).toEqual([
    {},
    { cursor: '3' },
    { cursor: '3' },
  ]);
  expect(screen.queryByRole('button', { name: '더 불러오기' })).toBeNull();
});
it('distinguishes empty filters and cancels a request when returning home', async () => {
  const empty = await open('empty');
  await tick();
  expect(screen.getByText('아직 쓴 카드가 없어요')).toBeTruthy();
  await tab('검수 중');
  await tick();
  expect(screen.getByText('검수 중인 카드가 없어요')).toBeTruthy();
  await tab('반려');
  await tick();
  expect(screen.getByText('반려된 카드가 없어요')).toBeTruthy();
  await empty.unmount();
  const { load, onBack } = await open('slow');
  await press('홈으로 돌아가기');
  expect(load.mock.calls[0][1].aborted).toBe(true);
  expect(onBack).toHaveBeenCalledTimes(1);
  await tick();
});

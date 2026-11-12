import { it, expect, jest, afterEach } from '@jest/globals';
import { act, render, screen, fireEvent } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { NightMorningFlow } from '../demo/NightMorningFlow';
import { createNightMorningDemo } from '../../mocks/nightMorningDemo';
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
const tick = () =>
  act(async () => {
    await jest.runAllTimersAsync();
  });
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});
it('saves two song cards, keeps the first saved on revisiting, then lists and removes them in the morning', async () => {
  jest.useFakeTimers();
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
  const demo = createNightMorningDemo();
  await render(
    <NightMorningFlow demo={demo} initialCount={6} onExit={() => {}} />,
  );
  await fireEvent.press(screen.getByRole('radio', { name: '고민 없음' }));
  await press('다음');
  await tick();
  await press('양 세기 시작');
  await tick();
  await tick();
  await press('다음 양');
  await press('다음 양');
  await press('노래 담기');
  await tick();
  await press('다음 양');
  await press('노래 담기');
  await tick();
  await press('이전 양');
  expect(screen.getByRole('button', { name: '노래 담기 취소' })).toBeTruthy();
  await press('다음 양');
  await press('다음 양');
  await press('다음 양');
  await press('마무리하기');
  await tick();
  await press('다음');
  await press('아침에 쓸게요');
  await tick();
  await press('밤 마무리 확인');
  await press('다음 아침으로 이동');
  await tick();
  await press('담은 노래 보기');
  await tick();
  expect(screen.getByText('밤의 산책 (예시)')).toBeTruthy();
  expect(screen.getByText('잠깐의 쉼 (예시)')).toBeTruthy();
  await fireEvent.press(
    screen.getAllByRole('button', { name: '담기 취소' })[0],
  );
  await tick();
  expect(screen.queryByText('밤의 산책 (예시)')).toBeNull();
  await press('양떼로 돌아가기');
  await press('담은 노래 보기');
  await tick();
  expect(screen.queryByText('밤의 산책 (예시)')).toBeNull();
  expect(screen.getByText('잠깐의 쉼 (예시)')).toBeTruthy();
});
async function openSong(demo: ReturnType<typeof createNightMorningDemo>) {
  jest.useFakeTimers();
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
  await render(
    <NightMorningFlow demo={demo} initialCount={6} onExit={() => {}} />,
  );
  await fireEvent.press(screen.getByRole('radio', { name: '고민 없음' }));
  await press('다음');
  await tick();
  await press('양 세기 시작');
  await tick();
  await tick();
  await press('다음 양');
  await press('다음 양');
}
it.each([false, true])(
  'keeps a delayed song change when saved=%s despite immediate next/previous or stage moves with reduced motion',
  async (saved) => {
    const demo = createNightMorningDemo();
    await openSong(demo);
    if (saved) {
      await press('노래 담기');
      await tick();
    }
    const set = jest.spyOn(demo.songs, 'set');
    await press(saved ? '노래 담기 취소' : '노래 담기');
    const request = set.mock.calls[0];
    await press('다음 양');
    await press('이전 양');
    expect(request[2].aborted).toBe(false);
    expect(screen.getByText('3 / 6')).toBeTruthy();
    expect(screen.getByRole('button', { name: '다음 양' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '이전 양' })).toBeDisabled();
    const stage = screen.getByLabelText('양 이동 영역');
    await fireEvent(stage, 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });
    await fireEvent(stage, 'accessibilityAction', {
      nativeEvent: { actionName: 'decrement' },
    });
    expect(screen.getByText('3 / 6')).toBeTruthy();
    expect(request[2].aborted).toBe(false);
    await tick();
    expect(
      screen.getByText(saved ? '담기를 취소했어요.' : '노래를 담았어요.'),
    ).toBeTruthy();
    await press('다음 양');
    await press('이전 양');
    expect(
      screen.getByRole('button', {
        name: saved ? '노래 담기' : '노래 담기 취소',
      }),
    ).toBeTruthy();
  },
);
it('unlocks movement after a failed song change while retaining the previous value', async () => {
  const demo = createNightMorningDemo();
  await openSong(demo);
  let reject!: (e: Error) => void;
  jest.spyOn(demo.songs, 'set').mockImplementationOnce(
    () =>
      new Promise((_resolve, r) => {
        reject = r;
      }),
  );
  await press('노래 담기');
  expect(screen.getByRole('button', { name: '다음 양' })).toBeDisabled();
  await act(async () => reject(new Error('network')));
  expect(screen.getByRole('button', { name: '다음 양' })).toBeEnabled();
  expect(screen.getByRole('button', { name: '노래 담기' })).toBeEnabled();
  await press('다음 양');
  expect(screen.getByText('4 / 6')).toBeTruthy();
});
it('explicitly leaving the feed cancels a pending change instead of trapping the user', async () => {
  const demo = createNightMorningDemo();
  await openSong(demo);
  const set = jest.spyOn(demo.songs, 'set');
  await press('노래 담기');
  expect(
    screen.getByText(
      '양 이동은 변경을 마치면 가능해요. 피드를 나가거나 그만 세면 진행 중인 요청을 취소해요.',
    ),
  ).toBeTruthy();
  await press('그만 세고 싶어요');
  expect(set.mock.calls[0][2].aborted).toBe(true);
  await tick();
  expect(screen.queryByText('노래를 담았어요.')).toBeNull();
});

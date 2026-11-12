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

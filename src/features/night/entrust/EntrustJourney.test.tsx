import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import Preview from '../../../app/dev/entrust';
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
const tick = (ms = 1000) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
it('connects entrusting to the closing count and morning reflection while omitting the pause from adoption', async () => {
  jest.useFakeTimers();
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
  await render(<Preview />);
  await press('맡기기부터 아침까지');
  for (let i = 0; i < 4; i++) await tick();
  expect(
    screen.getByText('내일 회의가 걱정돼요. 오늘 밤은 잠깐 쉬고 싶어요.'),
  ).toBeTruthy();
  await press('맡기기');
  await tick();
  await tick(2200);
  expect(screen.getByText('5 / 7')).toBeTruthy();
  await press('다음 양');
  await press('다음 양');
  await press('마무리하기');
  await tick();
  expect(screen.getByText(/맡긴 걱정 1개/)).toBeTruthy();
  await press('다음');
  await press('아침에 쓸게요');
  await tick();
  await press('밤 마무리 확인');
  await press('다음 아침으로 이동');
  // The shared home first checks the account clock, then reads that night's morning.
  for (let i = 0; i < 3; i++) await tick();
  expect(screen.queryByRole('radio', { name: '4번째 양' })).toBeNull();
  expect(screen.getByRole('radio', { name: '7번째 양' })).toBeTruthy();
  await press('이 양 데려오기');
  await tick();
  await tick();
  await press('어젯밤 돌아보기');
  await tick();
  expect(screen.getByText(/맡긴 걱정/)).toBeTruthy();
  expect(
    screen.getByText('내일 회의가 걱정돼요. 오늘 밤은 잠깐 쉬고 싶어요.'),
  ).toBeTruthy();
});

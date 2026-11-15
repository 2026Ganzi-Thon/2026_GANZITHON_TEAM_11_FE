import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { createMockNightReentry } from '../../../mocks/nightReentry';
import { NightReentryFlow } from './NightReentryFlow';
const press = (label: string) =>
  fireEvent.press(screen.getByRole('button', { name: label }));
async function settle() {
  for (let i = 0; i < 5; i++)
    await act(async () => {
      await jest.advanceTimersByTimeAsync(800);
    });
}
beforeEach(() => {
  jest.useFakeTimers();
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
it('moves back then explicitly reenters the same saved card while keeping the maximum viewed range', async () => {
  const actions = createMockNightReentry('active'),
    create = jest.spyOn(actions, 'createSession');
  await render(<NightReentryFlow actions={actions} onExit={() => {}} />);
  await settle();
  expect(screen.getByText('2 / 6')).toBeTruthy();
  await press('이전 양');
  expect(screen.getByText('1 / 6')).toBeTruthy();
  await press('미리보기 나가기');
  expect(screen.getByText(/본 양은 최대 4마리/)).toBeTruthy();
  await press('밤 상태 다시 확인');
  await settle();
  expect(screen.getByText('1 / 6')).toBeTruthy();
  await press('미리보기 나가기');
  expect(screen.getByText(/본 양은 최대 4마리/)).toBeTruthy();
  expect(create).not.toHaveBeenCalled();
});
it('records a first worry, creates once, then uses resume on reentry without asking for another worry', async () => {
  const actions = createMockNightReentry('new'),
    create = jest.spyOn(actions, 'createSession'),
    resume = jest.spyOn(actions, 'resume');
  await render(<NightReentryFlow actions={actions} onExit={() => {}} />);
  await settle();
  await fireEvent.press(screen.getByRole('radio', { name: '고민 없음' }));
  await press('다음');
  await settle();
  await fireEvent.press(screen.getByRole('radio', { name: '3마리' }));
  await press('양 세기 시작');
  await settle();
  expect(screen.getByText('1 / 3')).toBeTruthy();
  expect(create).toHaveBeenCalledTimes(1);
  expect(resume).not.toHaveBeenCalled();
  await press('미리보기 나가기');
  await press('밤 상태 다시 확인');
  await settle();
  expect(screen.getByText('1 / 3')).toBeTruthy();
  expect(create).toHaveBeenCalledTimes(1);
  expect(resume).toHaveBeenCalledTimes(1);
  expect(screen.queryByLabelText('오늘의 고민')).toBeNull();
});

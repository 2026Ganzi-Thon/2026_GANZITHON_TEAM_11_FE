import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, BackHandler } from 'react-native';
import { NightMorningFlow } from '../demo/NightMorningFlow';
import { createNightMorningDemo } from '../../mocks/nightMorningDemo';
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
const tick = (ms = 400) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
async function start(demo: ReturnType<typeof createNightMorningDemo>) {
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
  await tick(800);
}
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});
it('preserves confirmed yarn on pause/resume and in morning card records, while cancelling a pending change', async () => {
  let back: (() => void) | undefined;
  jest
    .spyOn(BackHandler, 'addEventListener')
    .mockImplementation((_event, callback) => {
      back = () => callback({} as Parameters<typeof callback>[0]);
      return { remove: () => {} };
    });
  const demo = createNightMorningDemo('slow-yarn');
  await start(demo);
  await press('털실 보내기');
  await tick(5000);
  await act(async () => back?.());
  expect(screen.getByText('시연을 잠깐 멈췄어요')).toBeTruthy();
  await press('이어 보기');
  await tick();
  expect(
    screen.getByRole('button', { name: '털실 보내기 취소' }),
  ).toBeSelected();
  await press('털실 보내기 취소');
  await act(async () => back?.());
  await tick(5000);
  await press('이어 보기');
  await tick();
  expect(
    screen.getByRole('button', { name: '털실 보내기 취소' }),
  ).toBeSelected();
  await press('그만 세고 싶어요');
  await tick(900);
  demo.advanceMorning();
  let morning!: Awaited<ReturnType<typeof demo.morning.loadMorning>>;
  await act(async () => {
    const request = demo.morning.loadMorning(new AbortController().signal);
    await jest.advanceTimersByTimeAsync(400);
    morning = await request;
  });
  expect(
    morning.candidate_cards.find((c) => c.card.id === 'preview-card-1')?.card
      .viewer.yarn_sent,
  ).toBe(true);
});
it('keeps yarn requests through movement while the existing song-save movement guard remains effective', async () => {
  const demo = createNightMorningDemo('slow-yarn');
  await start(demo);
  await press('다음 양');
  await press('다음 양');
  await press('털실 보내기');
  await press('노래 담기');
  expect(screen.getByRole('button', { name: '다음 양' })).toBeDisabled();
  await tick();
  expect(screen.getByRole('button', { name: '다음 양' })).toBeEnabled();
  await press('다음 양');
  await press('이전 양');
  await tick(4600);
  expect(screen.getByRole('button', { name: '노래 담기 취소' })).toBeSelected();
  expect(
    screen.getByRole('button', { name: '털실 보내기 취소' }),
  ).toBeSelected();
});

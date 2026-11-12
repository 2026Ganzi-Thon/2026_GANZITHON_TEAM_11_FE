import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { FeedScreen } from '../night/feed/FeedScreen';
import { NightMorningFlow } from '../demo/NightMorningFlow';
import { createFluffPreview } from '../../mocks/fluff';
import { createNightMorningDemo } from '../../mocks/nightMorningDemo';
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
const tick = (ms = 400) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
function timers() {
  jest.useFakeTimers();
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
}
async function open(demo = createFluffPreview()) {
  timers();
  const finish = jest.fn();
  const view = await render(
    <FeedScreen
      load={demo.load}
      fluff={demo.fluff}
      yarn={demo.yarn}
      onProgress={demo.progress}
      onFinish={finish}
      onBack={() => {}}
    />,
  );
  await tick(800);
  return { view, finish, demo };
}
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});
it('enables fluff and yarn independently and displays confirmed attached and removed state', async () => {
  await open();
  await press('솜털 붙이기');
  expect(screen.getByRole('button', { name: '솜털 떼기' })).toBeBusy();
  expect(screen.getByRole('button', { name: '솜털 떼기' })).not.toBeSelected();
  await tick();
  expect(screen.getByRole('button', { name: '솜털 떼기' })).toBeSelected();
  expect(
    screen.getByRole('button', { name: '털실 보내기' }),
  ).not.toBeSelected();
  await press('솜털 떼기');
  await tick();
  expect(
    screen.getByRole('button', { name: '솜털 붙이기' }),
  ).not.toBeSelected();
  expect(screen.getByText('솜털을 뗐어요')).toBeTruthy();
});
it('keeps delayed attach/remove while moving and blocks finish for offscreen requests', async () => {
  const { finish } = await open(createFluffPreview('slow'));
  await press('솜털 붙이기');
  await press('다음 양');
  expect(screen.getByText('2 / 6')).toBeTruthy();
  expect(screen.getByText('솜털 확인 중')).toBeTruthy();
  expect(
    screen.getByRole('button', { name: '그만 세고 싶어요' }),
  ).toBeDisabled();
  await press('그만 세고 싶어요');
  expect(finish).not.toHaveBeenCalled();
  await press('이전 양');
  await tick(5000);
  expect(screen.getByRole('button', { name: '솜털 떼기' })).toBeSelected();
  expect(
    screen.getByRole('button', { name: '그만 세고 싶어요' }),
  ).toBeEnabled();
  await press('솜털 떼기');
  await press('다음 양');
  await press('이전 양');
  await tick(5000);
  expect(
    screen.getByRole('button', { name: '솜털 붙이기' }),
  ).not.toBeSelected();
});
it('coalesces rapid changes and keeps only the final confirmed selection', async () => {
  const d = createFluffPreview('slow'),
    set = jest.spyOn(d.fluff, 'set');
  await open(d);
  await press('솜털 붙이기');
  await press('솜털 떼기');
  await press('솜털 붙이기');
  await tick(5000);
  expect(set).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: '솜털 떼기' })).toBeSelected();
});
it('retains removal failure on its own card and retries the same false intent', async () => {
  await open(createFluffPreview('remove-retry'));
  await press('솜털 떼기');
  await press('다음 양');
  await tick();
  expect(screen.queryByText('솜털 변경을 확인하지 못했어요')).toBeNull();
  await press('이전 양');
  expect(screen.getByRole('button', { name: '솜털 떼기' })).toBeSelected();
  await press('솜털 다시 시도');
  await tick();
  expect(
    screen.getByRole('button', { name: '솜털 붙이기' }),
  ).not.toBeSelected();
});
it('retries a lost attach followed by queued removal instead of claiming a saved mark', async () => {
  await open(createFluffPreview('lost-response'));
  await press('솜털 붙이기');
  await press('솜털 떼기');
  await tick();
  expect(screen.getByText('솜털 변경을 확인하지 못했어요')).toBeTruthy();
  await press('솜털 다시 시도');
  await tick();
  expect(
    screen.getByRole('button', { name: '솜털 붙이기' }),
  ).not.toBeSelected();
});
it('hides both reactions and cached content when fluff reports a deleted card', async () => {
  await open(createFluffPreview('unavailable'));
  await press('솜털 붙이기');
  await tick();
  expect(screen.queryByText(/나도 결과 기다리는/)).toBeNull();
  expect(
    screen.queryByRole('button', { name: /솜털 붙이기|털실 보내기/ }),
  ).toBeNull();
  expect(screen.getByText('지금은 볼 수 없는 카드예요')).toBeTruthy();
});
it('disables every fluff card after night-close and permits ending without endless retry', async () => {
  await open(createFluffPreview('closed'));
  await press('솜털 붙이기');
  await tick();
  expect(screen.getByText('솜털을 바꿀 수 없는 밤이에요')).toBeTruthy();
  expect(screen.getByRole('button', { name: '솜털 붙이기' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: '솜털 다시 시도' })).toBeNull();
  await press('다음 양');
  expect(screen.getByRole('button', { name: '솜털 붙이기' })).toBeDisabled();
  expect(
    screen.getByRole('button', { name: '그만 세고 싶어요' }),
  ).toBeEnabled();
});
it('aborts old scope on replacement even with reused ids and does not inherit its selection', async () => {
  const a = createFluffPreview('slow'),
    set = jest.spyOn(a.fluff, 'set');
  const { view } = await open(a);
  await press('솜털 붙이기');
  const b = createFluffPreview();
  await view.rerender(
    <FeedScreen
      load={b.load}
      fluff={b.fluff}
      onProgress={b.progress}
      onBack={() => {}}
    />,
  );
  await tick(800);
  expect(set.mock.calls[0][2].aborted).toBe(true);
  await tick(5000);
  expect(
    screen.getByRole('button', { name: '솜털 붙이기' }),
  ).not.toBeSelected();
});
it('carries a confirmed mark through closing count, morning order, default selection and adoption', async () => {
  timers();
  const demo = createNightMorningDemo();
  await render(
    <NightMorningFlow demo={demo} initialCount={6} onExit={() => {}} />,
  );
  await fireEvent.press(screen.getByRole('radio', { name: '고민 없음' }));
  await press('다음');
  await tick();
  await press('양 세기 시작');
  await tick(800);
  await tick(800);
  await press('솜털 붙이기');
  await tick();
  for (let i = 0; i < 5; i++) await press('다음 양');
  await press('마무리하기');
  await tick(600);
  expect(screen.getByText('오늘 밤 맡긴 걱정 0개 · 솜털 1개')).toBeTruthy();
  await press('다음');
  await press('아침에 쓸게요');
  await tick();
  await press('밤 마무리 확인');
  await press('다음 아침으로 이동');
  await tick();
  expect(screen.getAllByRole('radio')[0].props.accessibilityLabel).toBe(
    '1번째 양',
  );
  expect(screen.getByRole('radio', { name: '6번째 양' })).toBeChecked();
  await fireEvent.press(screen.getByRole('radio', { name: '1번째 양' }));
  expect(screen.getByText(/1번째 양 · 짧은 글 · 담은 솜털/)).toBeTruthy();
  await press('이 양 데려오기');
  await tick(1000);
  expect(screen.getByRole('button', { name: '어젯밤 돌아보기' })).toBeTruthy();
});

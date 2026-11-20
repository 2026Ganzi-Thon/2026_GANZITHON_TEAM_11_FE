import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, ScrollView } from 'react-native';
import { MorningScreen } from './MorningScreen';
import { createMockMorning } from '../../mocks/morning';
import { createMockFortune } from '../../mocks/fortune';

// These assertions count the one-off arrival, independently of idle wandering.
beforeEach(() => {
  jest
    .spyOn(Animated, 'loop')
    .mockReturnValue({ start: () => {}, stop: () => {}, reset: () => {} });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
const tick = () =>
  act(async () => {
    await jest.runAllTimersAsync();
  });
async function layout(cellY = 200) {
  const event = (y: number) => ({
    nativeEvent: { layout: { x: 0, y, width: 360, height: 100 } },
  });
  await fireEvent(screen.getByTestId('morning-pasture'), 'layout', event(400));
  await fireEvent(
    screen.getByTestId('morning-flock-grid'),
    'layout',
    event(80),
  );
  await fireEvent(
    screen.getByTestId('arriving-sheep-cell'),
    'layout',
    event(cellY),
  );
  const scroll = screen.container.queryAll(
    (n) => n.type === 'RCTScrollView',
  )[0];
  await fireEvent(scroll, 'contentSizeChange', 360, 1200);
  await tick();
}
it.each(['success', 'save-lost', 'flock-retry'] as const)(
  'arrives once after confirmed adoption and never creates another sheep on retry: %s',
  async (scenario) => {
    jest.useFakeTimers();
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(false);
    const start = jest.fn();
    jest
      .spyOn(Animated, 'timing')
      .mockReturnValue({ start, stop: () => {}, reset: () => {} });
    const scroll = jest.spyOn(ScrollView.prototype, 'scrollTo').mockClear();
    const actions = createMockMorning(scenario);
    const adopt = jest.spyOn(actions, 'adopt');
    await render(
      <MorningScreen
        actions={actions}
        loadDetail={actions.loadSheep}
        onExit={() => {}}
      />,
    );
    await tick();
    await fireEvent.press(
      screen.getByRole('button', { name: '이 양 데려오기' }),
    );
    expect(start).not.toHaveBeenCalled();
    await tick();
    if (scenario === 'save-lost') {
      expect(screen.queryByTestId('arriving-sheep-cell')).toBeNull();
      expect(start).not.toHaveBeenCalled();
      await fireEvent.press(
        screen.getByRole('button', { name: '이 양 데려오기' }),
      );
      await tick();
    }
    expect(start).not.toHaveBeenCalled();
    await layout();
    if (scenario === 'flock-retry') {
      expect(start).not.toHaveBeenCalled();
      expect(scroll).not.toHaveBeenCalled();
      await fireEvent.press(
        screen.getByRole('button', { name: '양떼 다시 불러오기' }),
      );
      await tick();
      await layout();
    }
    expect(start).toHaveBeenCalledTimes(1);
    expect(scroll).toHaveBeenCalledWith({ y: 580, animated: false });
    const sheep = screen.getByRole('button', { name: /새로 온 양/ });
    await fireEvent.press(sheep);
    await tick();
    await fireEvent.press(
      screen.getByRole('button', { name: '양떼로 돌아가기' }),
    );
    await layout();
    expect(start).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('button', { name: /새로 온 양/ })).toHaveLength(
      1,
    );
    expect(adopt).toHaveBeenCalledTimes(scenario === 'save-lost' ? 2 : 1);
  },
);
it.each([false, true])(
  'waits through flock failure and reveals only the retried list position (reduce motion: %s)',
  async (reduced) => {
    jest.useFakeTimers();
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(reduced);
    const start = jest.fn();
    jest
      .spyOn(Animated, 'timing')
      .mockReturnValue({ start, stop: () => {}, reset: () => {} });
    const scroll = jest.spyOn(ScrollView.prototype, 'scrollTo').mockClear();
    const actions = {
      ...createMockMorning('flock-retry'),
      fortune: createMockFortune(),
    };
    const fortuneLoad = jest.spyOn(actions.fortune, 'load');
    const load = actions.loadFlock;
    actions.loadFlock = async (signal) => {
      const items = await load(signal);
      const adopted = items.find((s) => s.id === 'preview-adopted')!;
      const older = Array.from({ length: 24 }, (_, index) => ({
        ...adopted,
        id: `older-${index}`,
        night_id: `old-night-${index}`,
        night_date: '2026-10-01',
      }));
      return [...older, ...items.filter((s) => s.id !== adopted.id), adopted];
    };
    await render(<MorningScreen actions={actions} onExit={() => {}} />);
    await tick();
    await fireEvent.press(
      screen.getByRole('button', { name: '이 양 데려오기' }),
    );
    await tick();
    await layout(0);
    expect(
      screen.getByRole('button', { name: '양떼 다시 불러오기' }),
    ).toBeTruthy();
    expect(scroll).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
    await fireEvent.press(
      screen.getByRole('button', { name: '양떼 다시 불러오기' }),
    );
    await tick();
    // Old fallback layout cannot satisfy the successful list's layout boundary.
    expect(scroll).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
    await layout(1400);
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(scroll).toHaveBeenCalledWith({ y: 1780, animated: false });
    expect(fortuneLoad).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledTimes(reduced ? 0 : 1);
    expect(
      screen.queryByRole('button', { name: '양떼 다시 불러오기' }),
    ).toBeNull();
  },
);
it('keeps an adoption from an earlier visit static', async () => {
  jest.useFakeTimers();
  const timing = jest.spyOn(Animated, 'timing');
  const actions = createMockMorning('existing');
  await render(<MorningScreen actions={actions} onExit={() => {}} />);
  await tick();
  expect(screen.queryAllByRole('button', { name: /의 양/ })).toHaveLength(0);
  expect(screen.queryByTestId('arriving-sheep-cell')).toBeNull();
  expect(timing).not.toHaveBeenCalled();
});
it('keeps the confirmed fallback static until the successful list contains that sheep', async () => {
  jest.useFakeTimers();
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(false);
  const start = jest.fn();
  jest
    .spyOn(Animated, 'timing')
    .mockReturnValue({ start, stop: () => {}, reset: () => {} });
  const scroll = jest.spyOn(ScrollView.prototype, 'scrollTo').mockClear();
  const actions = { ...createMockMorning(), loadFlock: async () => [] };
  await render(<MorningScreen actions={actions} onExit={() => {}} />);
  await tick();
  await fireEvent.press(screen.getByRole('button', { name: '이 양 데려오기' }));
  await tick();
  await layout();
  expect(screen.getByLabelText(/새로 온 양/)).toBeTruthy();
  expect(scroll).not.toHaveBeenCalled();
  expect(start).not.toHaveBeenCalled();
});

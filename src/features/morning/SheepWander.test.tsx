import { afterEach, expect, it, jest } from '@jest/globals';
import { act, render } from '@testing-library/react-native';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Text,
  type AppStateStatus,
} from 'react-native';
import { SheepWander, wanderRoute, usePastureMotion } from './SheepWander';

afterEach(() => {
  jest.restoreAllMocks();
});
const bounds = { minX: -12, maxX: 12, minY: 0, maxY: 6 };
it('keeps each slow route inside its pasture and gives sheep different paths', () => {
  const a = wanderRoute('sheep-a', bounds),
    b = wanderRoute('sheep-b', bounds);
  for (const route of [a, b]) {
    expect(
      route.every(
        (p) =>
          p.x >= -12 && p.x <= 12 && p.y >= 0 && p.y <= 6 && p.duration >= 4500,
      ),
    ).toBe(true);
    expect(route.at(-1)).toMatchObject({ x: 0, y: 0 });
  }
  expect(a).not.toEqual(b);
});

it('stops wandering for reduced motion, background, covered panels and unmount', async () => {
  let reduce!: (value: boolean) => void, app!: (state: AppStateStatus) => void;
  const remove = jest.fn(),
    start = jest.fn(),
    stop = jest.fn();
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(false);
  jest
    .spyOn(AccessibilityInfo, 'addEventListener')
    .mockImplementation((_event, fn) => {
      reduce = fn;
      return { remove };
    });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, fn) => {
    app = fn;
    return { remove };
  });
  jest
    .spyOn(Animated, 'loop')
    .mockReturnValue({ start, stop, reset: () => {} });
  function Scene({ covered = false }) {
    const enabled = usePastureMotion(!covered);
    return (
      <SheepWander id="sheep-a" enabled={enabled} bounds={bounds}>
        <Text>양</Text>
      </SheepWander>
    );
  }
  const view = await render(<Scene />);
  expect(start).toHaveBeenCalledTimes(1);
  await act(async () => reduce(true));
  expect(stop).toHaveBeenCalledTimes(1);
  await act(async () => reduce(false));
  expect(start).toHaveBeenCalledTimes(2);
  await act(async () => app('background'));
  expect(stop).toHaveBeenCalledTimes(2);
  await act(async () => app('active'));
  expect(start).toHaveBeenCalledTimes(3);
  await view.rerender(<Scene covered />);
  expect(stop).toHaveBeenCalledTimes(3);
  await view.rerender(<Scene />);
  expect(start).toHaveBeenCalledTimes(4);
  await view.unmount();
  expect(stop).toHaveBeenCalledTimes(4);
  expect(remove).toHaveBeenCalledTimes(2);
});

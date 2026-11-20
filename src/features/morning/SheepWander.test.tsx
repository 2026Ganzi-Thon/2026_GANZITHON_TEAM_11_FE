import { afterEach, expect, it, jest } from '@jest/globals';
import { act, render } from '@testing-library/react-native';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Text,
  type AppStateStatus,
} from 'react-native';
import {
  SheepWander,
  wanderRoute,
  wanderTimeline,
  usePastureMotion,
} from './SheepWander';

afterEach(() => {
  jest.restoreAllMocks();
});
const bounds = { minX: -12, maxX: 12, minY: 0, maxY: 6 };
it('keeps each slow route inside its pasture and gives sheep different paths', () => {
  const a = wanderRoute('sheep-a', bounds, 1),
    b = wanderRoute('sheep-b', bounds, 1);
  expect(a.length).toBeGreaterThan(10);
  expect(a).not.toEqual(wanderRoute('sheep-a', bounds, 2));
  for (const route of [a, b]) {
    expect(
      route.every(
        (p) =>
          p.x >= -12 && p.x <= 12 && p.y >= 0 && p.y <= 6 && p.duration >= 2500,
      ),
    ).toBe(true);
    expect(route.at(-1)).toMatchObject({ x: 0, y: 0 });
  }
  expect(a).not.toEqual(b);
});

it('faces the walking direction, turns during the pause and keeps positions in bounds', () => {
  const path = wanderTimeline([
    { x: 10, y: 3, duration: 4000, rest: 1000 },
    { x: -8, y: 6, duration: 6000, rest: 2000 },
    { x: 0, y: 0, duration: 3000, rest: 500 },
  ]);
  expect(path.x.at(-1)).toBe(0);
  expect(path.y.at(-1)).toBe(0);
  // Wait at the first target, then face left before travelling to the second.
  const turn = path.face.indexOf(-1);
  expect(path.x[turn]).toBe(10);
  expect(path.x[turn + 1]).toBe(-8);
  expect(path.face[turn + 1]).toBe(-1);
  expect(path.face.at(-1)).toBe(1);
  expect(path.inputRange[0]).toBe(0);
  expect(path.inputRange.at(-1)).toBe(1);
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

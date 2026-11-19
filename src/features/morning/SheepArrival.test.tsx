import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, render } from '@testing-library/react-native';
import { Animated, AppState, Text } from 'react-native';
import { SheepArrival } from './SheepArrival';

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
function fixture() {
  const start = jest.fn(),
    stop = jest.fn();
  const timing = jest
    .spyOn(Animated, 'timing')
    .mockReturnValue({ start, stop, reset: () => {} });
  let change: ((state: string) => void) | undefined;
  const remove = jest.fn();
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, listener) => {
      change = listener as (state: string) => void;
      return { remove };
    });
  return {
    timing,
    start,
    stop,
    remove,
    background: () => change?.('background'),
  };
}
const ui = (active: boolean, ready = true, reducedMotion = false) => (
  <SheepArrival
    active={active}
    ready={ready}
    reducedMotion={reducedMotion}
    scale={1}
  >
    <Text>양</Text>
  </SheepArrival>
);

it('animates only a newly confirmed sheep after the destination is ready, once across refreshes', async () => {
  const f = fixture();
  const view = await render(ui(true, false));
  expect(f.start).not.toHaveBeenCalled();
  await view.rerender(ui(true));
  expect(f.start).toHaveBeenCalledTimes(1);
  await view.rerender(ui(true));
  expect(f.start).toHaveBeenCalledTimes(1);
});
it('keeps existing sheep static', async () => {
  const f = fixture();
  await render(ui(false));
  expect(f.timing).not.toHaveBeenCalled();
});
it('skips motion when requested and does not replay when motion is later enabled', async () => {
  const f = fixture();
  const view = await render(ui(true, true, true));
  await view.rerender(ui(true));
  expect(f.timing).not.toHaveBeenCalled();
});
it('settles when motion is reduced mid-flight or the view is covered, without replaying', async () => {
  const f = fixture();
  const view = await render(ui(true));
  await view.rerender(ui(true, true, true));
  expect(f.stop).toHaveBeenCalled();
  await view.rerender(ui(true));
  await view.rerender(ui(true, false));
  await view.rerender(ui(true));
  expect(f.start).toHaveBeenCalledTimes(1);
});
it('settles on background and removes its listener and animation on unmount', async () => {
  const f = fixture();
  const view = await render(ui(true));
  await act(async () => {
    f.background();
  });
  expect(f.stop).toHaveBeenCalled();
  await view.rerender(ui(true));
  expect(f.start).toHaveBeenCalledTimes(1);
  await view.unmount();
  expect(f.remove).toHaveBeenCalled();
});

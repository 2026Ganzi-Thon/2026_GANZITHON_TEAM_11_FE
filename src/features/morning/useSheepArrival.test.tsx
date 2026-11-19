import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import {
  AccessibilityInfo,
  AppState,
  type LayoutChangeEvent,
} from 'react-native';
import { useSheepArrival } from './useSheepArrival';

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
const layout = (y: number) =>
  ({
    nativeEvent: { layout: { y, x: 0, width: 360, height: 300 } },
  }) as LayoutChangeEvent;
async function frame() {
  await act(async () => {
    jest.advanceTimersByTime(32);
  });
}

it('reveals the actual target row once after load and layout, without following later content changes', async () => {
  const view = await renderHook(
    ({ enabled }: { enabled: boolean }) => useSheepArrival('new', enabled),
    { initialProps: { enabled: false } },
  );
  const scrollTo = jest.fn();
  Object.assign(view.result.current.scrollRef, { current: { scrollTo } });
  await act(async () => {
    view.result.current.onPastureLayout(layout(400));
    view.result.current.onSheepLayout(600);
    view.result.current.onContentSizeChange();
  });
  await frame();
  expect(scrollTo).not.toHaveBeenCalled();
  await view.rerender({ enabled: true });
  await frame();
  expect(scrollTo).toHaveBeenCalledWith({ y: 900, animated: false });
  expect(view.result.current.ready).toBe(true);
  await act(async () => {
    view.result.current.onPastureLayout(layout(550));
    view.result.current.onSheepLayout(700);
    view.result.current.onContentSizeChange();
  });
  await view.rerender({ enabled: false });
  await view.rerender({ enabled: true });
  await frame();
  expect(scrollTo).toHaveBeenCalledTimes(1);
});
it('does not steal a manual scroll and settles pending motion', async () => {
  const view = await renderHook(() => useSheepArrival('new', true));
  const scrollTo = jest.fn();
  Object.assign(view.result.current.scrollRef, { current: { scrollTo } });
  await act(async () => {
    view.result.current.onPastureLayout(layout(400));
    view.result.current.onSheepLayout(100);
    view.result.current.onContentSizeChange();
  });
  await act(async () => view.result.current.onScrollBeginDrag());
  await frame();
  expect(scrollTo).not.toHaveBeenCalled();
  expect(view.result.current.ready).toBe(true);
  expect(view.result.current.reducedMotion).toBe(true);
});
it('waits for the successful list geometry and ignores late layout callbacks from its fallback', async () => {
  const view = await renderHook(
    ({ version, enabled }: { version: number; enabled: boolean }) =>
      useSheepArrival('new', enabled, version),
    { initialProps: { version: 0, enabled: false } },
  );
  const scrollTo = jest.fn();
  Object.assign(view.result.current.scrollRef, { current: { scrollTo } });
  const fallback = view.result.current;
  await act(async () => {
    fallback.onPastureLayout(layout(400));
    fallback.onSheepLayout(0);
    fallback.onContentSizeChange();
  });
  await view.rerender({ version: 1, enabled: true });
  await frame();
  expect(scrollTo).not.toHaveBeenCalled();
  await act(async () => {
    fallback.onPastureLayout(layout(300));
    fallback.onSheepLayout(10);
  });
  await frame();
  expect(scrollTo).not.toHaveBeenCalled();
  await act(async () => {
    view.result.current.onPastureLayout(layout(400));
    view.result.current.onSheepLayout(800);
  });
  await frame();
  expect(scrollTo).toHaveBeenCalledWith({ y: 1100, animated: false });
  const key = view.result.current.layoutKey;
  await view.rerender({ version: 2, enabled: true });
  await act(async () => {
    view.result.current.onPastureLayout(layout(500));
    view.result.current.onSheepLayout(900);
  });
  await frame();
  expect(view.result.current.layoutKey).toBe(key);
  expect(scrollTo).toHaveBeenCalledTimes(1);
});
it('cancels a pending reveal on unmount', async () => {
  const view = await renderHook(() => useSheepArrival('new', true));
  const scrollTo = jest.fn();
  Object.assign(view.result.current.scrollRef, { current: { scrollTo } });
  await act(async () => {
    view.result.current.onPastureLayout(layout(400));
    view.result.current.onSheepLayout(100);
    view.result.current.onContentSizeChange();
  });
  await view.unmount();
  await frame();
  expect(scrollTo).not.toHaveBeenCalled();
});
it('settles a pending arrival in the background without scrolling on return', async () => {
  let change!: (state: string) => void;
  const remove = jest.fn();
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, listener) => {
      change = listener as (state: string) => void;
      return { remove };
    });
  const view = await renderHook(() => useSheepArrival('new', true));
  const scrollTo = jest.fn();
  Object.assign(view.result.current.scrollRef, { current: { scrollTo } });
  await act(async () => {
    view.result.current.onPastureLayout(layout(400));
    view.result.current.onSheepLayout(100);
    view.result.current.onContentSizeChange();
  });
  await act(async () => {
    change('background');
    change('active');
  });
  await frame();
  expect(scrollTo).not.toHaveBeenCalled();
  expect(view.result.current.ready).toBe(true);
  expect(view.result.current.reducedMotion).toBe(true);
  await view.unmount();
  expect(remove).toHaveBeenCalledTimes(1);
});
it('keeps a live reduction preference over a late initial lookup and removes the listener', async () => {
  let resolve!: (value: boolean) => void;
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  let change!: (value: boolean) => void;
  const remove = jest.fn();
  jest
    .spyOn(AccessibilityInfo, 'addEventListener')
    .mockImplementation((_event, listener) => {
      change = listener;
      return { remove };
    });
  const view = await renderHook(() => useSheepArrival('new', true));
  expect(view.result.current.reducedMotion).toBe(true);
  await act(async () => {
    change(true);
    resolve(false);
  });
  expect(view.result.current.reducedMotion).toBe(true);
  await act(async () => change(false));
  expect(view.result.current.reducedMotion).toBe(false);
  await view.unmount();
  expect(remove).toHaveBeenCalledTimes(1);
});

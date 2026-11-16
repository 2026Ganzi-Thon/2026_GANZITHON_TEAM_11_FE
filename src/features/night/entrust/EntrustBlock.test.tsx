import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react-native';
import { AccessibilityInfo, Animated } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { useEntrustPause } from './useEntrustPause';
import type { EntrustActions, EntrustState } from './types';
import { deferred } from '../../../notifications/__tests__/fakeDevice';
import { createNightMorningDemo } from '../../../mocks/nightMorningDemo';
import { start } from '../../../mocks/__tests__/nightHistory';
import { FeedScreen } from '../feed/FeedScreen';
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
const tick = (ms = 1000) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
function port(): EntrustActions {
  return {
    item: { id: 'pause', position: 4, worry_text: '기존 고민' },
    load: async () => ({ item_id: 'pause', action: null }),
    save: async (action) => ({ item_id: 'pause', action }),
  };
}
it('does not query, save or retry while blocked and queries fresh state when released', async () => {
  const a = port(),
    load = jest.spyOn(a, 'load'),
    save = jest.spyOn(a, 'save');
  const hook = await renderHook(
    ({ blocked }: { blocked: boolean }) => useEntrustPause(a, blocked),
    { initialProps: { blocked: true } },
  );
  await act(async () => {
    await hook.result.current.choose('entrusted');
    await hook.result.current.retry();
  });
  expect(load).not.toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled();
  await hook.rerender({ blocked: false });
  expect(load).toHaveBeenCalledTimes(1);
  expect(hook.result.current.action).toBeNull();
});
it('aborts an in-flight choice, ignores its late receipt and reloads before another choice', async () => {
  const a = port(),
    late = deferred<EntrustState>(),
    save = jest.spyOn(a, 'save').mockImplementation(() => late.promise),
    load = jest.spyOn(a, 'load');
  const hook = await renderHook(
    ({ blocked }: { blocked: boolean }) => useEntrustPause(a, blocked),
    { initialProps: { blocked: false } },
  );
  await act(async () => {
    void hook.result.current.choose('entrusted');
  });
  await hook.rerender({ blocked: true });
  expect(save.mock.calls[0][1].aborted).toBe(true);
  await act(async () =>
    late.resolve({ item_id: 'pause', action: 'entrusted' }),
  );
  expect(hook.result.current.justSaved).toBe(false);
  await hook.rerender({ blocked: false });
  expect(load).toHaveBeenCalledTimes(2);
  expect(hook.result.current.action).toBeNull();
});
it('does not replay an errored choice through retry while verification blocks the feed', async () => {
  const a = port(),
    save = jest.spyOn(a, 'save').mockRejectedValue(new Error('lost response'));
  const hook = await renderHook(
    ({ blocked }: { blocked: boolean }) => useEntrustPause(a, blocked),
    { initialProps: { blocked: false } },
  );
  await act(async () => {
    await hook.result.current.choose('entrusted');
  });
  expect(hook.result.current.phase).toBe('error');
  await hook.rerender({ blocked: true });
  await act(async () => {
    await hook.result.current.retry();
  });
  expect(save).toHaveBeenCalledTimes(1);
});
it('cancels the success auto-advance when blocked and does not replay it on return', async () => {
  const d = createNightMorningDemo();
  await start(d, 7);
  d.progress({ position: 4, furthestPosition: 4 });
  const ui = (blocked: boolean) => (
    <SafeAreaInsetsContext.Provider
      value={{ top: 28, bottom: 24, left: 0, right: 0 }}
    >
      <FeedScreen
        load={d.loadFeed}
        entrust={d.entrust}
        onProgress={d.progress}
        initialPosition={d.getProgress()}
        onBack={() => {}}
        blocked={blocked}
      />
    </SafeAreaInsetsContext.Provider>
  );
  await render(ui(false));
  await tick();
  await fireEvent.press(screen.getByRole('button', { name: '맡기기' }));
  await tick(600);
  expect(d.getRecord().night?.entrusted).toBe(true);
  await screen.rerender(ui(true));
  await tick(3000);
  expect(screen.getByRole('button', { name: '다음 양' })).toBeDisabled();
  expect(d.getProgress().position).toBe(4);
  await screen.rerender(ui(false));
  await tick();
  await tick(3000);
  expect(d.getProgress().position).toBe(4);
  expect(
    screen.getByText('잘 받았어요. 오늘 밤은 내가 들고 있을게요.'),
  ).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: '다음 양' }));
  expect(d.getProgress().position).toBe(5);
});
it('does not commit an already-started auto-advance animation after blocking', async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false);
  let complete: ((result: { finished: boolean }) => void) | undefined;
  const stop = jest.fn();
  jest.spyOn(Animated, 'timing').mockImplementation(() => ({
    start: (callback) => {
      complete = callback;
    },
    stop,
    reset: () => {},
  }));
  const d = createNightMorningDemo();
  await start(d, 7);
  d.progress({ position: 4, furthestPosition: 4 });
  const ui = (blocked: boolean) => (
    <SafeAreaInsetsContext.Provider
      value={{ top: 28, bottom: 24, left: 0, right: 0 }}
    >
      <FeedScreen
        load={d.loadFeed}
        entrust={d.entrust}
        onProgress={d.progress}
        initialPosition={d.getProgress()}
        onBack={() => {}}
        blocked={blocked}
      />
    </SafeAreaInsetsContext.Provider>
  );
  await render(ui(false));
  await tick();
  await fireEvent.press(screen.getByRole('button', { name: '맡기기' }));
  await tick(600);
  await tick(1700);
  expect(complete).toBeDefined();
  expect(d.getProgress().position).toBe(4);
  await screen.rerender(ui(true));
  await act(async () => complete?.({ finished: true }));
  expect(d.getProgress().position).toBe(4);
});

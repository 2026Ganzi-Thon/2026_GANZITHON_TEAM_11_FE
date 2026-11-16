import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import { useEntrustPause } from './useEntrustPause';
import type { EntrustActions, EntrustState } from './types';
import { deferred } from '../../../notifications/__tests__/fakeDevice';
const item = { id: 'first', position: 4, worry_text: '첫 밤의 고민' };
function actions(id = 'first'): EntrustActions {
  return {
    item: { ...item, id },
    load: async () => ({ item_id: id, action: null }),
    save: async (action) => ({ item_id: id, action }),
  };
}
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
it('aborts an old submission and ignores its late success after the source is replaced', async () => {
  const old = deferred<EntrustState>(),
    a = actions(),
    b = actions('second');
  const save = jest.spyOn(a, 'save').mockImplementation(() => old.promise);
  const hook = await renderHook(
    ({ port }: { port: EntrustActions }) => useEntrustPause(port),
    {
      initialProps: { port: a },
    },
  );
  await act(async () => {
    void hook.result.current.choose('entrusted');
  });
  expect(hook.result.current.busy).toBe(true);
  await hook.rerender({ port: b });
  expect(save.mock.calls[0][1].aborted).toBe(true);
  await act(async () => old.resolve({ item_id: 'first', action: 'entrusted' }));
  expect(hook.result.current.action).toBeNull();
  await act(async () => {
    await hook.result.current.choose('skipped');
  });
  expect(hook.result.current.action).toBe('skipped');
});
it('does not acknowledge a mismatched receipt and retries only the original action', async () => {
  const a = actions(),
    save = jest
      .spyOn(a, 'save')
      .mockResolvedValueOnce({ item_id: 'other', action: 'entrusted' })
      .mockResolvedValueOnce({ item_id: 'first', action: 'entrusted' });
  const hook = await renderHook(() => useEntrustPause(a));
  await act(async () => {
    await hook.result.current.choose('entrusted');
  });
  expect(hook.result.current.phase).toBe('error');
  expect(hook.result.current.action).toBeNull();
  await act(async () => {
    await hook.result.current.choose('skipped');
  });
  expect(save).toHaveBeenCalledTimes(1);
  await act(async () => {
    await hook.result.current.retry();
  });
  expect(save.mock.calls.map((c) => c[0])).toEqual(['entrusted', 'entrusted']);
  expect(hook.result.current.action).toBe('entrusted');
});
it('aborts a pending state query on unmount and ignores its late failure', async () => {
  const late = deferred<EntrustState>(),
    a = actions(),
    load = jest.spyOn(a, 'load').mockImplementation(() => late.promise);
  const hook = await renderHook(() => useEntrustPause(a));
  await hook.unmount();
  expect(load.mock.calls[0][0].aborted).toBe(true);
  await act(async () => late.reject(new Error('late')));
  await jest.advanceTimersByTimeAsync(0);
  expect(jest.getTimerCount()).toBe(0);
});

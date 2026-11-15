import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { createMockNightEntry } from './nightEntry';
const draft = {
  category_id: 'career',
  worry_text: '입력 내용과 무관한 고정 시나리오',
} as const;
const signal = () => new AbortController().signal;
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
async function settled<T>(promise: Promise<T>) {
  await jest.advanceTimersByTimeAsync(800);
  return promise;
}
it('returns ready or fixed support based on the scenario rather than the words, and gates counting on continue', async () => {
  const plain = createMockNightEntry('success');
  await expect(settled(plain.checkWorry(draft, signal()))).resolves.toEqual({
    id: 'preview-night-entry',
    status: 'ready',
    support: null,
  });
  const api = createMockNightEntry('support');
  const checked = await settled(
    api.checkWorry({ category_id: 'none', worry_text: null }, signal()),
  );
  expect(checked).toMatchObject({
    id: 'preview-night-entry',
    status: 'needs_support',
    support: { resources: expect.any(Array) },
  });
  const blocked = expect(api.startCounting(3, signal())).rejects.toMatchObject({
    code: 'SUPPORT_REQUIRED',
  });
  await jest.advanceTimersByTimeAsync(800);
  await blocked;
  await expect(
    settled(api.continueSupport(checked.id, signal())),
  ).resolves.toEqual({ id: checked.id, active_session_id: null });
  await expect(
    settled(api.startCounting(3, signal())),
  ).resolves.toBeUndefined();
});
it('does not consume a continue failure or grant counting when the request is aborted', async () => {
  const api = createMockNightEntry('continue-retry'),
    abort = new AbortController();
  await settled(api.checkWorry(draft, signal()));
  const remove = jest.spyOn(abort.signal, 'removeEventListener');
  const cancelled = expect(
    api.continueSupport('preview-night-entry', abort.signal),
  ).rejects.toMatchObject({ kind: 'aborted' });
  abort.abort();
  await cancelled;
  expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  expect(jest.getTimerCount()).toBe(0);
  const failed = expect(
    api.continueSupport('preview-night-entry', signal()),
  ).rejects.toMatchObject({ kind: 'network' });
  await jest.advanceTimersByTimeAsync(800);
  await failed;
  await expect(
    settled(api.continueSupport('preview-night-entry', signal())),
  ).resolves.toMatchObject({ active_session_id: null });
  expect(jest.getTimerCount()).toBe(0);
});
it('keeps continue idempotent after a lost acknowledgement and rejects a different night ID', async () => {
  const api = createMockNightEntry('continue-lost-response');
  await settled(api.checkWorry(draft, signal()));
  const lost = expect(
    api.continueSupport('preview-night-entry', signal()),
  ).rejects.toMatchObject({ kind: 'network' });
  await jest.advanceTimersByTimeAsync(800);
  await lost;
  await expect(
    settled(api.continueSupport('preview-night-entry', signal())),
  ).resolves.toEqual({ id: 'preview-night-entry', active_session_id: null });
  const mismatch = expect(
    api.continueSupport('other-night', signal()),
  ).rejects.toMatchObject({ code: 'NIGHT_NOT_FOUND' });
  await jest.advanceTimersByTimeAsync(800);
  await mismatch;
});

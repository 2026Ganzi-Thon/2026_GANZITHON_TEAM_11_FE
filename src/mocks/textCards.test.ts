import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { createMockTextCards } from './textCards';
const request = {
  kind: 'text' as const,
  category_id: 'career' as const,
  content: { text: '오늘도 충분히 애썼어요.' },
  source_night_id: 'preview-night',
};
const signal = () => new AbortController().signal;
async function done<T>(p: Promise<T>) {
  await jest.runAllTimersAsync();
  return p;
}
afterEach(() => {
  jest.useRealTimers();
});
describe('text card drafts and submission', () => {
  it('preserves raw drafts but keeps the key for the same trimmed payload', () => {
    const api = createMockTextCards();
    const draft = api.writeDraft({
      category_id: 'career',
      text: ' 오늘도 충분히 애썼어요. ',
    });
    expect(api.readDraft()).toEqual(draft);
    const same = api.writeDraft({
      category_id: 'career',
      text: '오늘도 충분히 애썼어요.',
    });
    expect(same.operationKey).toBe(draft.operationKey);
    expect(
      api.writeDraft({ category_id: 'study', text: same.text }).operationKey,
    ).not.toBe(same.operationKey);
  });
  it('replays a lost response even after the night offer is fulfilled', async () => {
    jest.useFakeTimers();
    let allowed = true;
    const onSubmitted = jest.fn(() => {
      allowed = false;
    });
    const api = createMockTextCards('lost-response', {
      canSubmit: () => allowed,
      onSubmitted,
    });
    const key = api.readDraft().operationKey;
    const failure = expect(
      api.submit(request, key, signal()),
    ).rejects.toMatchObject({ kind: 'network' });
    await jest.runAllTimersAsync();
    await failure;
    const receipt = await done(api.submit(request, key, signal()));
    expect(receipt.moderation_status).toBe('pending');
    expect(onSubmitted).toHaveBeenCalledTimes(1);
    expect(await done(api.submit(request, key, signal()))).toEqual(receipt);
    const conflict = expect(
      api.submit({ ...request, content: { text: '다른 글' } }, key, signal()),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    await jest.runAllTimersAsync();
    await conflict;
  });
  it('does not accept unsupported categories, overlong content or a missing night entry', async () => {
    jest.useFakeTimers();
    const api = createMockTextCards();
    for (const value of [
      { ...request, category_id: 'none' as never },
      { ...request, content: { text: 'x'.repeat(201) } },
      { ...request, source_night_id: 'other-night' },
    ]) {
      const failure = expect(
        api.submit(value, 'key', signal()),
      ).rejects.toBeTruthy();
      await jest.runAllTimersAsync();
      await failure;
    }
    const denied = createMockTextCards('success', { canSubmit: () => false });
    const failure = expect(
      denied.submit(request, 'key', signal()),
    ).rejects.toMatchObject({ code: 'WRITING_ENTRY_REQUIRED' });
    await jest.runAllTimersAsync();
    await failure;
  });
  it('counts Unicode code points after trimming and never duplicates a successful submission', async () => {
    jest.useFakeTimers();
    const onSubmitted = jest.fn();
    const api = createMockTextCards('success', { onSubmitted });
    const value = { ...request, content: { text: '🙂'.repeat(200) } };
    const receipt = await done(api.submit(value, 'emoji', signal()));
    expect(receipt.content.text).toBe(value.content.text);
    expect(await done(api.submit(value, 'emoji', signal()))).toEqual(receipt);
    expect(onSubmitted).toHaveBeenCalledTimes(1);
  });
  it('cancels pending submissions without accepting a card and clears its timer', async () => {
    jest.useFakeTimers();
    const onSubmitted = jest.fn();
    const api = createMockTextCards('success', { onSubmitted });
    const controller = new AbortController();
    const failure = expect(
      api.submit(request, 'key', controller.signal),
    ).rejects.toMatchObject({ kind: 'aborted' });
    controller.abort();
    await failure;
    expect(onSubmitted).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });
  it('cleans abort listeners and timers after completion or an already cancelled request', async () => {
    jest.useFakeTimers();
    const api = createMockTextCards();
    const controller = new AbortController();
    const remove = jest.spyOn(controller.signal, 'removeEventListener');
    await done(api.submit(request, 'once', controller.signal));
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(jest.getTimerCount()).toBe(0);
    controller.abort();
    const onSubmitted = jest.fn();
    const cancelled = createMockTextCards('success', { onSubmitted });
    await expect(
      cancelled.submit(request, 'cancelled', controller.signal),
    ).rejects.toMatchObject({ kind: 'aborted' });
    expect(jest.getTimerCount()).toBe(0);
    expect(onSubmitted).not.toHaveBeenCalled();
  });
});

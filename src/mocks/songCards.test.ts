import { afterEach, expect, it, jest } from '@jest/globals';
import { createMockSongCards } from './songCards';
import type { SongCardRequest } from '../features/cards/songTypes';
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});
const body: SongCardRequest = {
  kind: 'song',
  category_id: 'career',
  source_night_id: 'preview-night',
  content: {
    track_id: 'preview-track-1',
    recommendation: '조용한 밤에 들어요',
  },
};
async function wait<T>(job: Promise<T>) {
  await jest.runAllTimersAsync();
  return job;
}
it('replays the same body/key once, rejects key reuse with another body, and fulfils the offer once', async () => {
  jest.useFakeTimers();
  const accepted = jest.fn(),
    actions = createMockSongCards('success', { onSubmitted: accepted });
  const first = await wait(
    actions.submit(body, 'key', new AbortController().signal),
  );
  expect(
    await wait(actions.submit(body, 'key', new AbortController().signal)),
  ).toEqual(first);
  const changed = actions.submit(
    { ...body, content: { ...body.content, recommendation: '다른 추천' } },
    'key',
    new AbortController().signal,
  );
  const failure = expect(changed).rejects.toMatchObject({
    status: 409,
    code: 'IDEMPOTENCY_CONFLICT',
  });
  await jest.runAllTimersAsync();
  await failure;
  expect(accepted).toHaveBeenCalledTimes(1);
});
it.each(['search', 'submit'] as const)(
  'cleans timers/listeners on aborted and completed %s',
  async (operation) => {
    jest.useFakeTimers();
    const actions = createMockSongCards(),
      controller = new AbortController();
    const cleanup = jest.spyOn(controller.signal, 'removeEventListener');
    const request =
      operation === 'search'
        ? actions.search('밤', controller.signal)
        : actions.submit(body, 'key', controller.signal);
    const failure = expect(request).rejects.toMatchObject({ kind: 'aborted' });
    controller.abort();
    await failure;
    expect(jest.getTimerCount()).toBe(0);
    expect(cleanup).toHaveBeenCalledWith('abort', expect.any(Function));
    const done = new AbortController(),
      doneCleanup = jest.spyOn(done.signal, 'removeEventListener');
    if (operation === 'search') await wait(actions.search('밤', done.signal));
    else await wait(actions.submit(body, 'key', done.signal));
    expect(jest.getTimerCount()).toBe(0);
    expect(doneCleanup).toHaveBeenCalledWith('abort', expect.any(Function));
  },
);

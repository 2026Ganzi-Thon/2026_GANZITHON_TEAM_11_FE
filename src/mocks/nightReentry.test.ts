import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { createMockNightReentry } from './nightReentry';
const signal = () => new AbortController().signal;
async function settled<T>(value: Promise<T>) {
  await jest.advanceTimersByTimeAsync(1600);
  return value;
}
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
it('resumes the same session, preserves backward progress and ignores a replaced lease', async () => {
  const source = createMockNightReentry('active');
  const first = await settled(source.resume('reentry-session-1', signal()));
  expect(first).toMatchObject({
    id: 'reentry-session-1',
    position: 2,
    furthest_position: 4,
    writer_epoch: 2,
    sequence: 0,
  });
  source.rememberPosition(first, { position: 1, furthestPosition: 3 });
  const second = await settled(source.resume(first.id, signal()));
  expect(second).toMatchObject({
    id: first.id,
    position: 1,
    furthest_position: 4,
    writer_epoch: 3,
    sequence: 0,
  });
  source.rememberPosition(first, { position: 5, furthestPosition: 5 });
  const third = await settled(source.resume(first.id, signal()));
  expect(third).toMatchObject({
    position: 1,
    furthest_position: 4,
    writer_epoch: 4,
    sequence: 0,
  });
});
it('keeps the first successful worry as a recorded night and refuses duplicate active-session creation', async () => {
  const source = createMockNightReentry('new');
  expect(await settled(source.bootstrap(signal()))).toMatchObject({
    next_screen: 'NIGHT_WORRY',
    night_id: null,
  });
  await settled(
    source.checkWorry({ category_id: 'none', worry_text: null }, signal()),
  );
  expect(await settled(source.bootstrap(signal()))).toMatchObject({
    next_screen: 'NIGHT_SHEEP_COUNT',
    night_id: 'reentry-night',
  });
  const created = await settled(
    source.createSession('reentry-night', 3, signal()),
  );
  expect(created).toMatchObject({
    id: 'reentry-session-1',
    position: 0,
    furthest_position: 0,
    writer_epoch: 1,
    sequence: 0,
  });
  const duplicate = expect(
    source.createSession('reentry-night', 3, signal()),
  ).rejects.toMatchObject({ code: 'ACTIVE_SESSION_EXISTS' });
  await jest.advanceTimersByTimeAsync(600);
  await duplicate;
  expect(await settled(source.bootstrap(signal()))).toMatchObject({
    next_screen: 'NIGHT_FEED',
    active_session_id: created.id,
  });
  expect(
    (await settled(source.loadFeed(created.id, signal()))).map((c) => c.id),
  ).toEqual(['preview-card-1', 'preview-card-2', 'preview-card-3']);
});
it.each(['create-lost-response', 'create-recovery-retry'] as const)(
  'keeps an actual session after losing its creation reply (%s)',
  async (scenario) => {
    const source = createMockNightReentry(scenario);
    expect(await settled(source.bootstrap(signal()))).toMatchObject({
      next_screen: 'NIGHT_WORRY',
    });
    await settled(
      source.checkWorry({ category_id: 'none', worry_text: null }, signal()),
    );
    const failed = expect(
      source.createSession('reentry-night', 3, signal()),
    ).rejects.toMatchObject({ kind: 'network' });
    await jest.advanceTimersByTimeAsync(600);
    await failed;
    if (scenario === 'create-recovery-retry') {
      const failedLookup = expect(
        source.bootstrap(signal()),
      ).rejects.toMatchObject({ kind: 'network' });
      await jest.advanceTimersByTimeAsync(600);
      await failedLookup;
    }
    expect(await settled(source.bootstrap(signal()))).toMatchObject({
      next_screen: 'NIGHT_FEED',
      active_session_id: 'reentry-session-1',
    });
    expect(
      await settled(source.resume('reentry-session-1', signal())),
    ).toMatchObject({ id: 'reentry-session-1', sheep_count: 3, position: 0 });
  },
);
it('keeps support on each explicit reentry and uses the same active session after continue', async () => {
  const source = createMockNightReentry('support-active');
  expect(await settled(source.bootstrap(signal()))).toMatchObject({
    next_screen: 'NIGHT_SUPPORT',
  });
  expect(
    await settled(source.continueSupport('reentry-night', signal())),
  ).toEqual({ id: 'reentry-night', active_session_id: 'reentry-session-1' });
  await settled(source.resume('reentry-session-1', signal()));
  expect(await settled(source.bootstrap(signal()))).toMatchObject({
    next_screen: 'NIGHT_SUPPORT',
    active_session_id: 'reentry-session-1',
  });
});
it('does not advance a lease on cancellation and retries a lost resume response without creating a different session', async () => {
  const source = createMockNightReentry('resume-lost-response'),
    controller = new AbortController();
  const pending = expect(
    source.resume('reentry-session-1', controller.signal),
  ).rejects.toMatchObject({ kind: 'aborted' });
  controller.abort();
  await pending;
  expect(jest.getTimerCount()).toBe(0);
  const lost = expect(
    source.resume('reentry-session-1', signal()),
  ).rejects.toMatchObject({ kind: 'network' });
  await jest.advanceTimersByTimeAsync(600);
  await lost;
  expect(
    await settled(source.resume('reentry-session-1', signal())),
  ).toMatchObject({
    id: 'reentry-session-1',
    position: 2,
    furthest_position: 4,
    writer_epoch: 3,
  });
  expect(jest.getTimerCount()).toBe(0);
});

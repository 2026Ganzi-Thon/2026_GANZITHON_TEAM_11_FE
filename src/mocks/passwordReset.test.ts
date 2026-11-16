import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { createMockPasswordReset } from './passwordReset';
import { settle, signal } from './__tests__/nightHistory';
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});
it('returns the same receipt regardless of registered or unknown addresses', async () => {
  const known = await settle(
    createMockPasswordReset('success').request('known@example.com', signal()),
  );
  const unknown = await settle(
    createMockPasswordReset('unknown-email').request(
      'unknown@example.com',
      signal(),
    ),
  );
  expect(known).toEqual({ accepted: true });
  expect(unknown).toEqual(known);
});
it('lets an explicit retry recover from a transient failure', async () => {
  const actions = createMockPasswordReset('network-once');
  await settle(
    expect(actions.request('mock@example.com', signal())).rejects.toMatchObject(
      { kind: 'network' },
    ),
  );
  expect(await settle(actions.request('mock@example.com', signal()))).toEqual({
    accepted: true,
  });
});
it('aborts a slow request and removes its timer', async () => {
  const controller = new AbortController();
  const actions = createMockPasswordReset('slow');
  const pending = actions.request('mock@example.com', controller.signal);
  const rejected = expect(pending).rejects.toMatchObject({ kind: 'aborted' });
  controller.abort();
  await rejected;
  expect(jest.getTimerCount()).toBe(0);
});
it.each(['limited-seconds', 'limited-date'] as const)(
  'enforces %s until its deadline',
  async (scenario) => {
    jest.setSystemTime(new Date('2026-11-17T00:00:00Z'));
    const actions = createMockPasswordReset(scenario);
    await settle(
      expect(
        actions.request('mock@example.com', signal()),
      ).rejects.toMatchObject({ status: 429, retryAfter: expect.any(String) }),
    );
    await settle(
      expect(
        actions.request('mock@example.com', signal()),
      ).rejects.toMatchObject({ status: 429 }),
    );
    await jest.advanceTimersByTimeAsync(5000);
    expect(await settle(actions.request('mock@example.com', signal()))).toEqual(
      { accepted: true },
    );
  },
);

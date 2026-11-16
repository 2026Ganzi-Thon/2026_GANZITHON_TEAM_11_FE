import { afterEach, expect, it, jest } from '@jest/globals';
import { createMockSignup } from './signup';
const signal = () => new AbortController().signal;
afterEach(() => {
  jest.useRealTimers();
});
async function run<T>(promise: Promise<T>) {
  await jest.runAllTimersAsync();
  return promise;
}
it('recovers one committed registration by operation key without another account', async () => {
  jest.useFakeTimers();
  const a = createMockSignup('register-lost');
  const p = a.register(
    'key',
    { email: 'a@example.com', password: 'password' },
    signal(),
  );
  const failed = expect(p).rejects.toMatchObject({ kind: 'network' });
  await jest.runAllTimersAsync();
  await failed;
  const first = await run(
    a.register(
      'key',
      { email: 'a@example.com', password: 'password' },
      signal(),
    ),
  );
  const second = await run(
    a.register(
      'key',
      { email: 'a@example.com', password: 'password' },
      signal(),
    ),
  );
  expect(second).toEqual(first);
  const dup = a.register(
    'new-key',
    { email: 'a@example.com', password: 'password' },
    signal(),
  );
  const duplicate = expect(dup).rejects.toMatchObject({
    code: 'EMAIL_ALREADY_USED',
  });
  await jest.runAllTimersAsync();
  await duplicate;
});
it('requires current required consents and saves the initial birth date without spending an edit', async () => {
  jest.useFakeTimers();
  const a = createMockSignup();
  const user = await run(
    a.register(
      'key',
      { email: 'a@example.com', password: 'password' },
      signal(),
    ),
  );
  const docs = await run(a.loadDocuments(signal()));
  await run(
    a.consent(
      user.id,
      {
        revision: docs.revision,
        choices: {
          terms: true,
          privacy: true,
          processing: true,
          notifications: false,
        },
      },
      signal(),
    ),
  );
  const result = await run(a.birth(user.id, '2000-02-29', signal()));
  expect(result.birth_date).toBe('2000-02-29');
  expect(result.edits_remaining).toBe(1);
  expect(result.zodiac).toBe('pisces');
  expect(await run(a.birth(user.id, '2000-02-29', signal()))).toEqual(result);
});
it('cleans up aborted mock work without committing registration', async () => {
  jest.useFakeTimers();
  const a = createMockSignup('slow'),
    c = new AbortController(),
    cleanup = jest.spyOn(c.signal, 'removeEventListener');
  const p = a.register(
      'key',
      { email: 'a@example.com', password: 'password' },
      c.signal,
    ),
    rejected = expect(p).rejects.toMatchObject({ kind: 'aborted' });
  c.abort();
  await rejected;
  expect(jest.getTimerCount()).toBe(0);
  expect(cleanup).toHaveBeenCalledWith('abort', expect.any(Function));
  expect(
    (
      await run(
        a.register(
          'other',
          { email: 'a@example.com', password: 'password' },
          signal(),
        ),
      )
    ).email,
  ).toBe('a@example.com');
});

it('validates birth dates against the same injected KST day exposed to the signup form', async () => {
  jest.useFakeTimers();
  let time = Date.parse('2026-11-16T23:59:59+09:00');
  const a = createMockSignup('success', () => time);
  const user = await run(
    a.register(
      'clock-key',
      { email: 'clock@example.com', password: 'password' },
      signal(),
    ),
  );
  await run(
    a.consent(
      user.id,
      {
        revision: 'v1',
        choices: {
          terms: true,
          privacy: true,
          processing: true,
          notifications: false,
        },
      },
      signal(),
    ),
  );
  const rejected = expect(
    a.birth(user.id, '2026-11-17', signal()),
  ).rejects.toMatchObject({ status: 422 });
  await jest.runAllTimersAsync();
  await rejected;
  time = Date.parse('2026-11-17T00:00:00+09:00');
  const receipt = await run(a.birth(user.id, '2026-11-17', signal()));
  expect(receipt.birth_date).toBe('2026-11-17');
  expect(a.today).toBe('2026-11-17');
});

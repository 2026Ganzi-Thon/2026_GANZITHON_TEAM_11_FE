import { expect, it, jest } from '@jest/globals';
import { createMockAccountScope } from './accountScope';
import { deferred } from '../notifications/__tests__/fakeDevice';
it('revokes captured reads and writes and aborts in-flight work even when the adapter ignores cancellation', async () => {
  const pending = deferred<string>();
  const load = jest.fn<(signal: AbortSignal) => Promise<string>>(
    () => pending.promise,
  );
  const save = jest.fn<(value: string, signal: AbortSignal) => Promise<void>>(
    async () => {},
  );
  const scope = createMockAccountScope();
  const old = scope.protect({
    nested: { load, save, read: () => 'private record' },
  });
  const request = old.nested.load(new AbortController().signal);
  const result = expect(request).rejects.toMatchObject({ kind: 'aborted' });
  scope.revoke();
  expect(load.mock.calls[0][0].aborted).toBe(true);
  await result;
  pending.resolve('late private record');
  await expect(
    old.nested.load(new AbortController().signal),
  ).rejects.toMatchObject({ code: 'ACCOUNT_WITHDRAWN' });
  await expect(
    old.nested.save('new', new AbortController().signal),
  ).rejects.toMatchObject({ code: 'ACCOUNT_WITHDRAWN' });
  expect(() => old.nested.read()).toThrow();
  expect(save).not.toHaveBeenCalled();
});
it('propagates caller cancellation without revoking the account or returning a late success', async () => {
  const pending = deferred<string>();
  const signal = new AbortController();
  const scope = createMockAccountScope();
  const raw = jest.fn<(signal: AbortSignal) => Promise<string>>(
    () => pending.promise,
  );
  const source = scope.protect({ load: raw, read: () => 2 });
  const result = source.load(signal.signal);
  signal.abort();
  await expect(result).rejects.toMatchObject({ kind: 'aborted' });
  expect(raw.mock.calls[0][0].aborted).toBe(true);
  pending.resolve('late');
  expect(source.read()).toBe(2);
});
it('keeps method identities stable and removes caller listeners after settled work', async () => {
  const scope = createMockAccountScope();
  const source = scope.protect({ load: async (_signal: AbortSignal) => 'ok' });
  const controller = new AbortController();
  const add = jest.spyOn(controller.signal, 'addEventListener');
  const remove = jest.spyOn(controller.signal, 'removeEventListener');
  expect(source.load).toBe(source.load);
  await expect(source.load(controller.signal)).resolves.toBe('ok');
  expect(remove).toHaveBeenCalledWith('abort', add.mock.calls[0][1]);
  scope.revoke();
  expect(controller.signal.aborted).toBe(false);
});
it('leaves the explicitly excluded lifecycle port able to complete revocation', async () => {
  const lifecycle = {
    withdraw: async () => {
      scope.revoke();
    },
  };
  const scope = createMockAccountScope(lifecycle);
  const protectedSource = scope.protect({ lifecycle, read: () => 3 });
  await expect(protectedSource.lifecycle.withdraw()).resolves.toBeUndefined();
  expect(() => protectedSource.read()).toThrow();
});

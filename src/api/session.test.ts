import { it, expect } from '@jest/globals';
import { createApiClient } from './client';
import { createApiSession, type TokenStore } from './session';
import type { Auth } from './contracts';

const old: Auth = {
  access_token: 'old',
  refresh_token: 'refresh-1',
  token_type: 'Bearer',
  expires_in: 3600,
};
const fresh: Auth = { ...old, access_token: 'new', refresh_token: 'refresh-2' };
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });
function setup(fetch: typeof globalThis.fetch) {
  let saved: Auth | null = old;
  const store: TokenStore = {
    read: async () => saved,
    write: async (v) => {
      saved = v;
    },
  };
  const session = createApiSession(
    createApiClient({ baseUrl: 'https://example.com/api/v1', fetch }),
    store,
  );
  return { session, saved: () => saved };
}
it('restores tokens and shares a rotating refresh across concurrent 401 responses', async () => {
  let refreshes = 0;
  const keys: string[] = [];
  const { session, saved } = setup(async (url, init) => {
    const h = new Headers(init?.headers);
    if (String(url).endsWith('/auth/refresh')) {
      refreshes++;
      expect(JSON.parse(init?.body as string)).toEqual({
        refresh_token: 'refresh-1',
      });
      await Promise.resolve();
      return json(fresh);
    }
    keys.push(h.get('Idempotency-Key')!);
    return h.get('Authorization') === 'Bearer new'
      ? json({ ok: true })
      : json({ error: { code: 'UNAUTHORIZED' } }, 401);
  });
  await session.restore();
  await expect(
    Promise.all([
      session.request('/me', { idempotencyKey: 'a' }),
      session.request('/me', { idempotencyKey: 'b' }),
    ]),
  ).resolves.toEqual([{ ok: true }, { ok: true }]);
  expect(refreshes).toBe(1);
  expect(saved()).toEqual(fresh);
  expect(keys.sort()).toEqual(['a', 'a', 'b', 'b']);
});
it('keeps the refresh operation key after an uncertain response', async () => {
  const keys: string[] = [];
  const { session } = setup(async (url, init) => {
    if (String(url).endsWith('/auth/refresh')) {
      keys.push(new Headers(init?.headers).get('Idempotency-Key')!);
      if (keys.length === 1) throw new Error('lost response');
      return json(fresh);
    }
    return new Headers(init?.headers).get('Authorization') === 'Bearer new'
      ? json({ ok: true })
      : json({ error: { code: 'UNAUTHORIZED' } }, 401);
  });
  await session.restore();
  await expect(session.request('/me')).rejects.toMatchObject({
    kind: 'network',
  });
  await expect(session.request('/me')).resolves.toEqual({ ok: true });
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
});
it('does not restore a late refresh after local sign-out', async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const { session, saved } = setup(async (url) => {
    if (String(url).endsWith('/auth/refresh')) {
      await gate;
      return json(fresh);
    }
    return json({ error: { code: 'UNAUTHORIZED' } }, 401);
  });
  await session.restore();
  const request = session.request('/me');
  await new Promise((r) => setTimeout(r, 0));
  await session.clear();
  release();
  await expect(request).rejects.toMatchObject({ kind: 'aborted' });
  expect(saved()).toBeNull();
});

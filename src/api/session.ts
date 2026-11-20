import type { createApiClient, RequestOptions } from './client';
import type { Auth, LoginRequest } from './contracts';
import { ApiError } from './errors';

export interface TokenStore {
  read(): Promise<Auth | null>;
  write(value: Auth | null): Promise<void>;
}
export const operationKey = () =>
  `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
function readAuth(value: unknown): Auth {
  const v = value as Auth;
  if (
    !v ||
    v.token_type !== 'Bearer' ||
    !v.access_token?.trim() ||
    !v.refresh_token?.trim() ||
    !Number.isFinite(v.expires_in) ||
    v.expires_in <= 0
  )
    throw new ApiError('invalid-response');
  return v;
}
export function createApiSession(
  client: ReturnType<typeof createApiClient>,
  store: TokenStore,
) {
  let auth: Auth | null = null,
    generation = 0;
  let refreshing: Promise<void> | null = null;
  let refreshWork: { token: string; key: string } | null = null;
  let writes: Promise<void> = Promise.resolve();
  const listeners = new Set<() => void>();
  const persist = (value: Auth | null) => {
    const next = writes.catch(() => undefined).then(() => store.write(value));
    writes = next;
    return next;
  };
  const check = (version: number, signal?: AbortSignal) => {
    if (version !== generation || signal?.aborted)
      throw new ApiError('aborted');
  };
  async function clear() {
    ++generation;
    auth = null;
    refreshing = null;
    refreshWork = null;
    try {
      await persist(null);
    } finally {
      listeners.forEach((f) => f());
    }
  }
  async function authenticate(
    kind: 'register' | 'login',
    body: LoginRequest,
    key: string,
    signal: AbortSignal,
  ) {
    const version = generation;
    const next = readAuth(
      await client.request(`/auth/${kind}`, {
        method: 'POST',
        body,
        idempotencyKey: key,
        signal,
      }),
    );
    check(version, signal);
    await persist(next);
    check(version, signal);
    auth = next;
    refreshWork = null;
  }
  async function refresh(previous: Auth, version: number) {
    if (auth !== previous) return;
    if (refreshing) return refreshing;
    refreshWork ??= { token: previous.refresh_token, key: operationKey() };
    const work = refreshWork;
    const job = (async () => {
      try {
        const next = readAuth(
          await client.request('/auth/refresh', {
            method: 'POST',
            body: { refresh_token: work.token },
            idempotencyKey: work.key,
          }),
        );
        check(version);
        await persist(next);
        check(version);
        auth = next;
        refreshWork = null;
      } catch (error) {
        if (
          version === generation &&
          error instanceof ApiError &&
          error.status === 401
        )
          await clear();
        throw error;
      }
    })();
    refreshing = job;
    try {
      await job;
    } finally {
      if (refreshing === job) refreshing = null;
    }
  }
  return {
    client,
    async restore() {
      const version = generation;
      const saved = await store.read();
      check(version);
      auth = saved ? readAuth(saved) : null;
      return !!auth;
    },
    hasAuth: () => !!auth,
    authenticate,
    clear,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
      const previous = auth,
        version = generation;
      check(version, options.signal);
      if (!previous)
        throw new ApiError('http', { status: 401, code: 'UNAUTHORIZED' });
      try {
        const result = await client.request<T>(path, {
          ...options,
          accessToken: previous.access_token,
        });
        check(version, options.signal);
        return result as T;
      } catch (error) {
        check(version, options.signal);
        if (!(error instanceof ApiError) || error.status !== 401) throw error;
        await refresh(previous, version);
        check(version, options.signal);
        if (!auth)
          throw new ApiError('http', { status: 401, code: 'UNAUTHORIZED' });
        const result = await client.request<T>(path, {
          ...options,
          accessToken: auth.access_token,
        });
        check(version, options.signal);
        return result as T;
      }
    },
    async logout(signal: AbortSignal) {
      const previous = auth,
        version = generation;
      check(version, signal);
      const revoke = (current: Auth) =>
        client.request('/auth/logout', {
          method: 'POST',
          accessToken: current.access_token,
          body: { refresh_token: current.refresh_token },
          signal,
        });
      if (previous) {
        try {
          await revoke(previous);
        } catch (error) {
          check(version, signal);
          if (!(error instanceof ApiError) || error.status !== 401) throw error;
          await refresh(previous, version);
          check(version, signal);
          if (auth) await revoke(auth);
        }
        check(version, signal);
      }
      await clear();
    },
  };
}
export type ApiSession = ReturnType<typeof createApiSession>;

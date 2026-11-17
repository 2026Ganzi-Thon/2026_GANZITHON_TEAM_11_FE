import { ApiError } from '../api/errors';
/** Revocable boundary for one preview account's action tree, not an auth layer. */
export function createMockAccountScope(lifecycle?: object) {
  let closed = false;
  const pending = new Set<AbortController>();
  const objects = new WeakMap<object, object>();
  const inactive = () =>
    new ApiError('http', { status: 410, code: 'ACCOUNT_WITHDRAWN' });
  function protect<T extends object>(source: T): T {
    if (source === lifecycle) return source;
    const cached = objects.get(source);
    if (cached) return cached as T;
    const methods = new Map<
      PropertyKey,
      { original: unknown; guarded: (...args: unknown[]) => unknown }
    >();
    const proxy = new Proxy(source, {
      get(target, key) {
        const value: unknown = Reflect.get(target, key, target);
        if (typeof value === 'function') {
          const old = methods.get(key);
          if (old?.original === value) return old.guarded;
          const invoke = (...args: unknown[]) => {
            const parent = args.find((arg) => arg instanceof AbortSignal) as
              AbortSignal | undefined;
            if (closed) {
              if (parent) return Promise.reject(inactive());
              throw inactive();
            }
            if (parent?.aborted) return Promise.reject(new ApiError('aborted'));
            const request = new AbortController();
            const abort = () => request.abort();
            const cleanup = () => {
              pending.delete(request);
              parent?.removeEventListener('abort', abort);
            };
            pending.add(request);
            parent?.addEventListener('abort', abort, { once: true });
            let result: unknown;
            try {
              result = Reflect.apply(
                value,
                target,
                args.map((arg) =>
                  parent && arg === parent ? request.signal : arg,
                ),
              );
            } catch (error) {
              cleanup();
              throw error;
            }
            if (
              result &&
              typeof (result as PromiseLike<unknown>).then === 'function'
            ) {
              let cancel!: () => void;
              const cancelled = new Promise<never>((_resolve, reject) => {
                cancel = () => reject(new ApiError('aborted'));
                request.signal.addEventListener('abort', cancel, {
                  once: true,
                });
                if (request.signal.aborted) cancel();
              });
              return Promise.race([Promise.resolve(result), cancelled])
                .then((value) => {
                  if (closed || request.signal.aborted)
                    throw new ApiError('aborted');
                  return value;
                })
                .finally(() => {
                  request.signal.removeEventListener('abort', cancel);
                  cleanup();
                });
            }
            cleanup();
            if (closed) throw inactive();
            return result && typeof result === 'object'
              ? protect(result)
              : result;
          };
          const guarded = new Proxy(value as (...args: unknown[]) => unknown, {
            apply: (_fn, _this, args) => invoke(...args),
          });
          methods.set(key, { original: value, guarded });
          return guarded;
        }
        if (value && typeof value === 'object') return protect(value);
        if (closed) throw inactive();
        return value;
      },
    });
    objects.set(source, proxy);
    return proxy;
  }
  return {
    protect,
    revoke: () => {
      closed = true;
      for (const request of pending) request.abort();
      pending.clear();
    },
  };
}

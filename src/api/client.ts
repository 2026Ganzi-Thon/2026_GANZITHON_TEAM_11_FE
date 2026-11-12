import { getApiBaseUrl } from './config';
import { ApiError, httpError } from './errors';

type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: JsonValue;
  accessToken?: string;
  idempotencyKey?: string;
  signal?: AbortSignal;
}

export type ApiTransport = (
  url: string,
  init?: RequestInit,
) => Promise<Response>;

interface ClientOptions {
  baseUrl: string;
  fetch?: ApiTransport;
  timeoutMs?: number;
}

export function createApiClient(options: ClientOptions) {
  const baseUrl = `${getApiBaseUrl(options.baseUrl)}/`;
  const fetcher = options.fetch ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 10_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
    throw new ApiError('configuration');

  return {
    /** T describes the expected contract; consumers still validate required response fields. */
    async request<T = unknown>(
      path: string,
      request: RequestOptions = {},
    ): Promise<T | undefined> {
      let url: URL;
      try {
        if (
          !path.startsWith('/') ||
          path.startsWith('//') ||
          path.includes('#')
        ) {
          throw new Error();
        }
        url = new URL(path.slice(1), baseUrl);
        if (!url.href.startsWith(baseUrl)) throw new Error();
      } catch {
        throw new ApiError('configuration');
      }
      if (request.signal?.aborted) throw new ApiError('aborted');

      const method = request.method ?? 'GET';
      if (method === 'GET' && request.body !== undefined)
        throw new ApiError('configuration');
      let serializedBody: string | undefined;
      try {
        serializedBody =
          request.body === undefined ? undefined : JSON.stringify(request.body);
      } catch {
        throw new ApiError('configuration');
      }

      const headers = new Headers({ Accept: 'application/json' });
      if (request.accessToken)
        headers.set('Authorization', `Bearer ${request.accessToken}`);
      if (request.idempotencyKey)
        headers.set('Idempotency-Key', request.idempotencyKey);
      if (request.body !== undefined)
        headers.set('Content-Type', 'application/json');

      const controller = new AbortController();
      let abortKind: 'aborted' | 'timeout' | undefined;
      const abort = (kind: 'aborted' | 'timeout') => {
        abortKind ??= kind;
        controller.abort();
      };
      const onAbort = () => abort('aborted');
      request.signal?.addEventListener('abort', onAbort, { once: true });
      const timer = setTimeout(() => abort('timeout'), timeoutMs);

      try {
        const response = await fetcher(url.href, {
          method,
          headers,
          body: serializedBody,
          signal: controller.signal,
        });
        if (response.status === 204) return undefined;
        const text = await response.text();
        let body: unknown;
        if (text.trim()) {
          try {
            body = JSON.parse(text);
          } catch {
            if (response.ok)
              throw new ApiError('invalid-response', {
                status: response.status,
              });
          }
        }
        if (!response.ok) throw httpError(response, body);
        return body as T | undefined;
      } catch (error) {
        if (abortKind) throw new ApiError(abortKind);
        if (error instanceof ApiError) throw error;
        throw new ApiError('network');
      } finally {
        clearTimeout(timer);
        request.signal?.removeEventListener('abort', onAbort);
      }
    },
  };
}

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { createApiClient, type ApiTransport } from './client';
import { createMockFetch } from '../mocks/transport';

const baseUrl = 'https://mock.invalid/api/v1';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function caller() {
  const controller = new AbortController();
  const added = jest.spyOn(controller.signal, 'addEventListener');
  const removed = jest.spyOn(controller.signal, 'removeEventListener');
  return {
    controller,
    expectCleanedUp() {
      expect(added).toHaveBeenCalledTimes(1);
      expect(removed).toHaveBeenCalledTimes(1);
      expect(removed).toHaveBeenCalledWith('abort', added.mock.calls[0][1]);
    },
  };
}

describe('cancellation across response and body reads', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it.each([200, 204])(
    'rejects an immediately cancelled mock response with status %s',
    async (status) => {
      const { controller, expectCleanedUp } = caller();
      const client = createApiClient({
        baseUrl,
        fetch: createMockFetch([
          {
            method: 'GET',
            path: '/api/v1/bootstrap',
            status,
            body: status === 204 ? undefined : { ok: true },
          },
        ]),
      });
      const request = client.request('/bootstrap', {
        signal: controller.signal,
      });
      controller.abort();
      await expect(request).rejects.toMatchObject({ kind: 'aborted' });
      expect(jest.getTimerCount()).toBe(0);
      expectCleanedUp();
    },
  );

  it('ends at 10ms even when the body ignores abort and resolves at 40ms', async () => {
    const { controller, expectCleanedUp } = caller();
    const response = new Response();
    jest.spyOn(response, 'text').mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve('{"ok":true}'), 40);
        }),
    );
    const fetcher = jest.fn<ApiTransport>().mockResolvedValue(response);
    const client = createApiClient({ baseUrl, fetch: fetcher, timeoutMs: 10 });
    const settled = jest.fn();
    const request = client
      .request('/bootstrap', { signal: controller.signal })
      .then(
        (value) => settled({ value }),
        (error) => settled({ kind: error.kind }),
      );
    await jest.advanceTimersByTimeAsync(10);
    expect(settled).toHaveBeenCalledWith({ kind: 'timeout' });
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expectCleanedUp();
    // Only the uncooperative body reader's own timer remains.
    expect(jest.getTimerCount()).toBe(1);
    controller.abort();
    await jest.advanceTimersByTimeAsync(30);
    await request;
    expect(settled).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each(['fetch', 'body'] as const)(
    'bounds an unresponsive %s and handles its late rejection',
    async (phase) => {
      const { controller, expectCleanedUp } = caller();
      const response = new Response();
      const pendingResponse = deferred<Response>();
      const pendingBody = deferred<string>();
      jest
        .spyOn(response, 'text')
        .mockImplementation(() => pendingBody.promise);
      const fetcher = jest
        .fn<ApiTransport>()
        .mockImplementation(() =>
          phase === 'fetch'
            ? pendingResponse.promise
            : Promise.resolve(response),
        );
      const client = createApiClient({
        baseUrl,
        fetch: fetcher,
        timeoutMs: 10,
      });
      const settled = jest.fn();
      const request = client
        .request('/bootstrap', { signal: controller.signal })
        .then(
          (value) => settled({ value }),
          (error) => settled({ kind: error.kind }),
        );
      await jest.advanceTimersByTimeAsync(10);
      expect(settled).toHaveBeenCalledWith({ kind: 'timeout' });
      expect(jest.getTimerCount()).toBe(0);
      expectCleanedUp();
      if (phase === 'fetch')
        pendingResponse.reject(new Error('late transport failure'));
      else pendingBody.reject(new Error('late body failure'));
      await jest.advanceTimersByTimeAsync(0);
      await request;
      expect(settled).toHaveBeenCalledTimes(1);
    },
  );

  it('cancels during a body read without waiting for the reader', async () => {
    const { controller, expectCleanedUp } = caller();
    const body = deferred<string>();
    const response = new Response();
    const read = jest
      .spyOn(response, 'text')
      .mockImplementation(() => body.promise);
    const fetcher = jest.fn<ApiTransport>().mockResolvedValue(response);
    const client = createApiClient({ baseUrl, fetch: fetcher, timeoutMs: 10 });
    const settled = jest.fn();
    const request = client
      .request('/bootstrap', { signal: controller.signal })
      .then(
        (value) => settled({ value }),
        (error) => settled({ kind: error.kind }),
      );
    await jest.advanceTimersByTimeAsync(0);
    expect(read).toHaveBeenCalledTimes(1);
    controller.abort();
    await jest.advanceTimersByTimeAsync(0);
    expect(settled).toHaveBeenCalledWith({ kind: 'aborted' });
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
    expectCleanedUp();
    body.resolve('{"ok":true}');
    await jest.advanceTimersByTimeAsync(20);
    await request;
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it.each([200, 503])(
    'cleans up after a non-cancelled response with status %s',
    async (status) => {
      const { controller, expectCleanedUp } = caller();
      const fetcher = jest
        .fn<ApiTransport>()
        .mockResolvedValue(Response.json({ ok: true }, { status }));
      const client = createApiClient({
        baseUrl,
        fetch: fetcher,
        timeoutMs: 10,
      });
      const request = client.request('/bootstrap', {
        signal: controller.signal,
      });
      if (status === 200) await expect(request).resolves.toEqual({ ok: true });
      else
        await expect(request).rejects.toMatchObject({
          kind: 'http',
          status: 503,
        });
      expect(jest.getTimerCount()).toBe(0);
      expectCleanedUp();
      controller.abort();
      await jest.advanceTimersByTimeAsync(20);
      expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(false);
    },
  );
});

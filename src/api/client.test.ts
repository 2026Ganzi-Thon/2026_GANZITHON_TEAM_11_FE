import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { createApiClient, type ApiTransport } from './client';

const baseUrl = 'https://api.example.com/api/v1';

function setup(response: Response) {
  const fetcher = jest.fn<ApiTransport>().mockResolvedValue(response);
  return { client: createApiClient({ baseUrl, fetch: fetcher }), fetcher };
}

describe('API client', () => {
  it('rejects a GET body before sending a request', async () => {
    const { client, fetcher } = setup(Response.json({ ok: true }));
    await expect(
      client.request('/bootstrap', { body: { unexpected: true } }),
    ).rejects.toMatchObject({ kind: 'configuration' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('reports a circular JSON body as a request configuration error', async () => {
    type Circular = { loop: Circular | null };
    const body: Circular = { loop: null };
    body.loop = body;
    const { client, fetcher } = setup(Response.json({ ok: true }));
    await expect(
      client.request('/auth/login', { method: 'POST', body }),
    ).rejects.toMatchObject({ kind: 'configuration' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('keeps the API prefix and sends JSON, bearer token, and the supplied idempotency key', async () => {
    const { client, fetcher } = setup(Response.json({ accepted: true }));

    await expect(
      client.request('/auth/login', {
        method: 'POST',
        body: { email: 'test@example.com', password: 'test-only-password' },
        accessToken: 'test-access',
        idempotencyKey: 'login-attempt-1',
      }),
    ).resolves.toEqual({ accepted: true });

    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('https://api.example.com/api/v1/auth/login');
    expect(init).toMatchObject({
      method: 'POST',
      body: '{"email":"test@example.com","password":"test-only-password"}',
    });
    const headers = new Headers(init?.headers);
    expect(headers.get('Authorization')).toBe('Bearer test-access');
    expect(headers.get('Idempotency-Key')).toBe('login-attempt-1');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('Accept')).toBe('application/json');
  });

  it('does not attach authentication or a JSON content type to a public GET', async () => {
    const { client, fetcher } = setup(Response.json({ items: [] }));
    await client.request('/legal-documents');
    const headers = new Headers(fetcher.mock.calls[0][1]?.headers);
    expect(headers.has('Authorization')).toBe(false);
    expect(headers.has('Content-Type')).toBe(false);
    expect(fetcher.mock.calls[0][1]?.body).toBeUndefined();
  });

  it('does not attempt to parse a 204 response', async () => {
    const response = new Response(null, { status: 204 });
    const readBody = jest.spyOn(response, 'text');
    const { client } = setup(response);
    await expect(
      client.request('/me/day-intro', {
        method: 'PUT',
        body: { acknowledged: true },
      }),
    ).resolves.toBeUndefined();
    expect(readBody).not.toHaveBeenCalled();
  });

  it('distinguishes an empty successful response from malformed JSON', async () => {
    await expect(
      setup(new Response('')).client.request('/empty'),
    ).resolves.toBeUndefined();
    await expect(
      setup(new Response('<html>unexpected</html>')).client.request(
        '/bootstrap',
      ),
    ).rejects.toMatchObject({ kind: 'invalid-response', status: 200 });
  });

  it('preserves server error codes, field errors, request IDs, and Retry-After', async () => {
    const { client } = setup(
      Response.json(
        {
          error: {
            code: 'REQUEST_IN_PROGRESS',
            message: 'Try again later',
            fields: { email: 'invalid' },
            request_id: 'req_test_1',
          },
        },
        { status: 409, headers: { 'Retry-After': '3' } },
      ),
    );
    await expect(
      client.request('/auth/login', { method: 'POST' }),
    ).rejects.toMatchObject({
      kind: 'http',
      status: 409,
      code: 'REQUEST_IN_PROGRESS',
      serverMessage: 'Try again later',
      fields: { email: 'invalid' },
      requestId: 'req_test_1',
      retryAfter: '3',
    });
  });

  it('retains HTTP status when a proxy returns HTML instead of the error envelope', async () => {
    const { client } = setup(
      new Response('<html>proxy unavailable</html>', { status: 503 }),
    );
    await expect(client.request('/bootstrap')).rejects.toMatchObject({
      kind: 'http',
      status: 503,
      code: undefined,
    });
  });

  it('does not leak raw server bodies or credentials into the default error message', async () => {
    const { client } = setup(
      Response.json(
        {
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'sensitive-server-detail',
            fields: {},
            request_id: 'req_test',
          },
        },
        { status: 401 },
      ),
    );
    await expect(
      client.request('/auth/login', {
        method: 'POST',
        body: { password: 'secret-input' },
      }),
    ).rejects.toThrow('HTTP 401');
  });

  it('does not automatically replay failed mutations or authentication requests', async () => {
    const { client, fetcher } = setup(
      Response.json({ error: { code: 'TOKEN_EXPIRED' } }, { status: 401 }),
    );
    await expect(
      client.request('/sessions', {
        method: 'POST',
        idempotencyKey: 'attempt-1',
      }),
    ).rejects.toMatchObject({ kind: 'http', status: 401 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('keeps a caller-supplied idempotency key across manual retries', async () => {
    const { client, fetcher } = setup(Response.json({ ok: true }));
    fetcher.mockRejectedValueOnce(new TypeError('connection lost'));
    const options = {
      method: 'POST' as const,
      body: { sheep_count: 3 },
      idempotencyKey: 'same-operation',
    };
    await expect(client.request('/sessions', options)).rejects.toMatchObject({
      kind: 'network',
    });
    await client.request('/sessions', options);
    expect(
      fetcher.mock.calls.map(([, init]) =>
        new Headers(init?.headers).get('Idempotency-Key'),
      ),
    ).toEqual(['same-operation', 'same-operation']);
  });

  it('normalizes transport failures without retaining their sensitive raw message', async () => {
    const fetcher = jest
      .fn<ApiTransport>()
      .mockRejectedValue(new TypeError('private URL detail'));
    const client = createApiClient({ baseUrl, fetch: fetcher });
    await expect(client.request('/bootstrap')).rejects.toMatchObject({
      kind: 'network',
      message: 'Network request failed',
    });
  });

  it.each([
    'https://other.example/steal',
    '//other.example/steal',
    '/../outside',
    '/%2e%2e/outside',
    '/bootstrap#fragment',
  ])('rejects a path escaping the configured API: %s', async (path) => {
    const { client, fetcher } = setup(Response.json({ ok: true }));
    await expect(
      client.request(path, { accessToken: 'test-access' }),
    ).rejects.toMatchObject({ kind: 'configuration' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('normalizes a trailing base slash while preserving an encoded query', async () => {
    const fetcher = jest
      .fn<ApiTransport>()
      .mockResolvedValue(Response.json({ items: [] }));
    const client = createApiClient({ baseUrl: `${baseUrl}/`, fetch: fetcher });
    await client.request('/music/search?q=%EC%96%91');
    expect(fetcher.mock.calls[0][0]).toBe(
      `${baseUrl}/music/search?q=%EC%96%91`,
    );
  });
});

describe('request cancellation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  function pendingFetch() {
    return jest.fn<ApiTransport>().mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new Error('aborted')),
            { once: true },
          );
        }),
    );
  }

  it('aborts a timed-out request and reports timeout separately from network failure', async () => {
    const fetcher = pendingFetch();
    const client = createApiClient({ baseUrl, fetch: fetcher, timeoutMs: 100 });
    const assertion = expect(
      client.request('/bootstrap'),
    ).rejects.toMatchObject({ kind: 'timeout' });
    await jest.advanceTimersByTimeAsync(100);
    await assertion;
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('propagates caller cancellation without reporting a network error', async () => {
    const controller = new AbortController();
    const client = createApiClient({ baseUrl, fetch: pendingFetch() });
    const assertion = expect(
      client.request('/bootstrap', { signal: controller.signal }),
    ).rejects.toMatchObject({ kind: 'aborted' });
    controller.abort();
    await assertion;
    expect(jest.getTimerCount()).toBe(0);
  });

  it('does not send an already-cancelled request', async () => {
    const controller = new AbortController();
    controller.abort();
    const { client, fetcher } = setup(Response.json({ ok: true }));
    await expect(
      client.request('/bootstrap', { signal: controller.signal }),
    ).rejects.toMatchObject({ kind: 'aborted' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('clears the timeout after a successful response', async () => {
    const { client } = setup(Response.json({ ok: true }));
    await client.request('/bootstrap');
    expect(jest.getTimerCount()).toBe(0);
  });
});

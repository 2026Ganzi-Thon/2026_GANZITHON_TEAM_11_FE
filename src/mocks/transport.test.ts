import { describe, expect, it } from '@jest/globals';
import { createApiClient } from '../api/client';
import type { Auth, Bootstrap } from '../api/contracts';
import {
  authFixture,
  bootstrapFixture,
  invalidCredentialsFixture,
} from './fixtures';
import { createMockFetch } from './transport';

describe('client with an explicit mock transport', () => {
  it('uses the same request interface for authentication and bootstrap and supports repeat reads', async () => {
    const client = createApiClient({
      baseUrl: 'https://mock.invalid/api/v1',
      fetch: createMockFetch([
        { method: 'POST', path: '/api/v1/auth/login', body: authFixture },
        { method: 'GET', path: '/api/v1/bootstrap', body: bootstrapFixture },
      ]),
    });
    const auth = await client.request<Auth>('/auth/login', {
      method: 'POST',
      body: { email: 'user@example.com', password: 'test-password' },
      idempotencyKey: 'login-1',
    });
    expect(auth?.token_type).toBe('Bearer');
    for (let i = 0; i < 2; i++) {
      const bootstrap = await client.request<Bootstrap>('/bootstrap', {
        accessToken: auth?.access_token,
      });
      expect(bootstrap?.next_screen).toBe('NIGHT_WORRY');
      expect(bootstrap?.active_session_id).toBeNull();
      expect(bootstrap?.user.stats.night_count).toBe(0);
    }
  });

  it('uses the real error parser for a mocked login failure', async () => {
    const client = createApiClient({
      baseUrl: 'https://mock.invalid/api/v1',
      fetch: createMockFetch([
        {
          method: 'POST',
          path: '/api/v1/auth/login',
          status: 401,
          body: invalidCredentialsFixture,
        },
      ]),
    });
    await expect(
      client.request('/auth/login', { method: 'POST' }),
    ).rejects.toMatchObject({
      kind: 'http',
      status: 401,
      code: 'INVALID_CREDENTIALS',
      requestId: 'mock-request-1',
    });
  });

  it('distinguishes empty data and no-content success', async () => {
    const client = createApiClient({
      baseUrl: 'https://mock.invalid/api/v1',
      fetch: createMockFetch([
        {
          method: 'GET',
          path: '/api/v1/sheep',
          body: { items: [], next_cursor: null },
        },
        { method: 'POST', path: '/api/v1/auth/logout', status: 204 },
      ]),
    });
    await expect(client.request('/sheep')).resolves.toEqual({
      items: [],
      next_cursor: null,
    });
    await expect(
      client.request('/auth/logout', { method: 'POST' }),
    ).resolves.toBeUndefined();
  });

  it('reports unconfigured routes instead of silently using the network or a success fixture', async () => {
    const client = createApiClient({
      baseUrl: 'https://mock.invalid/api/v1',
      fetch: createMockFetch([]),
    });
    await expect(client.request('/bootstrap')).rejects.toMatchObject({
      kind: 'http',
      status: 501,
      code: 'MOCK_ROUTE_NOT_FOUND',
    });
  });
});

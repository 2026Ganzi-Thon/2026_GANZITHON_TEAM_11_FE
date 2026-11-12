import type { ApiTransport } from '../api/client';

interface MockRoute {
  method: string;
  /** Full pathname, including /api/v1. Query parameters do not select a route. */
  path: string;
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
}

/** Explicit opt-in transport for development/tests. Never forwards to a server. */
export function createMockFetch(routes: readonly MockRoute[]): ApiTransport {
  return async (input, init) => {
    const url = new URL(input);
    if (init?.signal?.aborted) throw new Error('Request cancelled');
    const method = (init?.method ?? 'GET').toUpperCase();
    const route = routes.find(
      (route) =>
        route.method.toUpperCase() === method && route.path === url.pathname,
    );
    if (!route) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'MOCK_ROUTE_NOT_FOUND',
            message: 'No mock route configured',
            fields: {},
            request_id: 'mock-unconfigured',
          },
        }),
        { status: 501, headers: { 'Content-Type': 'application/json' } },
      );
    }
    const headers = new Headers(route.headers);
    if (route.body !== undefined)
      headers.set('Content-Type', 'application/json');
    return new Response(
      route.body === undefined ? null : JSON.stringify(route.body),
      {
        status: route.status ?? 200,
        headers,
      },
    );
  };
}

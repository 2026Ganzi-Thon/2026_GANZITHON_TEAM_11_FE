import { it, expect } from '@jest/globals';
import { createApiClient } from './client';
import { createApiSession } from './session';
import { createLiveResources } from './resources';
import { createLiveNight } from './night';
import type { Bootstrap } from './contracts';

it('resumes with server writer ownership, serializes progress and keeps finish retries identical', async () => {
  const writes: {
    path: string;
    body: Record<string, unknown>;
    key: string | null;
  }[] = [];
  const sessionData = {
    id: 'session-1',
    night_id: 'night-1',
    sheep_count: 3,
    position: 2,
    furthest_position: 2,
    writer_epoch: 4,
    sequence: 0,
    closes_at: '2026-11-20T19:00:00Z',
  };
  let finishFailed = false;
  const api = createApiSession(
    createApiClient({
      baseUrl: 'https://example.com/api/v1',
      fetch: async (url, init) => {
        const path = new URL(url).pathname;
        const body = init?.body ? JSON.parse(init.body as string) : {};
        writes.push({
          path,
          body,
          key: new Headers(init?.headers).get('Idempotency-Key'),
        });
        if (path.endsWith('/resume'))
          return new Response(JSON.stringify(sessionData));
        if (path.endsWith('/feed'))
          return new Response(
            JSON.stringify({
              session_id: 'session-1',
              total_count: 3,
              items: [1, 2, 3].map((p) => ({
                id: `item-${p}`,
                position: p,
                type: 'card',
                card: { id: `card-${p}` },
              })),
            }),
          );
        if (path.endsWith('/progress'))
          return new Response(JSON.stringify(body));
        if (path.endsWith('/finish')) {
          if (!finishFailed) {
            finishFailed = true;
            throw new Error('lost');
          }
          return new Response(
            JSON.stringify({
              summary: { counted: 3, entrusted_count: 0, fluff_count: 0 },
              closing_card: null,
              writing_offer: { state: 'deferred' },
            }),
          );
        }
        return new Response(null, { status: 204 });
      },
    }),
    {
      read: async () => ({
        access_token: 'a',
        refresh_token: 'r',
        token_type: 'Bearer',
        expires_in: 3600,
      }),
      write: async () => {},
    },
  );
  await api.restore();
  const night = createLiveNight(api, createLiveResources(api), {
    night_id: 'night-1',
    active_session_id: 'session-1',
  } as Bootstrap);
  await night.resume(new AbortController().signal);
  await night.progress(
    { position: 3, furthestPosition: 3 },
    new AbortController().signal,
  );
  const input = {
    reason: 'completed' as const,
    position: 3,
    furthestPosition: 3,
    sheepCount: 3,
  };
  await expect(
    night.closing.finish(input, 'finish-key', new AbortController().signal),
  ).rejects.toMatchObject({ kind: 'network' });
  await night.closing.finish(input, 'finish-key', new AbortController().signal);
  const progress = writes.find((r) => r.path.endsWith('/progress'))!;
  expect(progress.body).toMatchObject({
    writer_epoch: 4,
    sequence: 1,
    furthest_position: 3,
  });
  const finishes = writes.filter((r) => r.path.endsWith('/finish'));
  expect(finishes[0]).toEqual(finishes[1]);
  expect(finishes[0].body).toMatchObject({
    writer_epoch: 4,
    sequence: 2,
    reason: 'completed',
  });
});

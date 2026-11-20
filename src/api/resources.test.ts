import { it, expect } from '@jest/globals';
import { createApiClient } from './client';
import { createApiSession } from './session';
import { createLiveResources } from './resources';

it('uses the server consent versions, unwraps /me and retains 204 semantics', async () => {
  const requests: { path: string; method: string; body: unknown }[] = [];
  const client = createApiClient({
    baseUrl: 'https://example.com/api/v1',
    fetch: async (url, init) => {
      const path = new URL(url).pathname.replace('/api/v1', '');
      requests.push({
        path,
        method: init?.method ?? 'GET',
        body: init?.body ? JSON.parse(init.body as string) : undefined,
      });
      if (path === '/legal-documents')
        return new Response(
          JSON.stringify({
            items: [
              {
                type: 'terms',
                title: '이용약관',
                version: 'terms-3',
                body_url: 'https://example.com/terms',
                required: true,
              },
              {
                type: 'privacy',
                title: '개인정보',
                version: 'privacy-5',
                body_url: 'https://example.com/privacy',
                required: true,
              },
            ],
          }),
        );
      if (path === '/me')
        return new Response(
          JSON.stringify({
            user: {
              id: 'u',
              email: 'u@example.com',
              birth_date: '2000-01-01',
              birth_date_edits_remaining: 1,
              stats: {
                night_count: 0,
                counted_sheep_total: 0,
                worry_record_count: 0,
              },
            },
            reminder: { enabled: false, local_time: null },
          }),
        );
      return new Response(null, { status: 204 });
    },
  });
  const session = createApiSession(client, {
    read: async () => ({
      access_token: 'access',
      refresh_token: 'refresh',
      token_type: 'Bearer',
      expires_in: 3600,
    }),
    write: async () => {},
  });
  await session.restore();
  const resources = createLiveResources(session);
  const docs = await resources.signup.loadDocuments(
    new AbortController().signal,
  );
  await resources.signup.consent(
    'u',
    {
      revision: docs.revision,
      choices: { terms: true, privacy: true, notifications: false },
    },
    new AbortController().signal,
  );
  expect(requests.find((r) => r.path === '/me/consents')?.body).toEqual({
    terms_version: 'terms-3',
    privacy_version: 'privacy-5',
    terms_accepted: true,
    privacy_accepted: true,
  });
  expect(
    (await resources.settings.loadMe(new AbortController().signal)).user.email,
  ).toBe('u@example.com');
  await expect(
    resources.settings.deletions!.remove(
      'night 1',
      new AbortController().signal,
    ),
  ).resolves.toBeUndefined();
  expect(requests.at(-1)?.path).toBe('/nights/night%201/worry');
});

it('does not replace server errors with mock cards or fortunes', async () => {
  const session = createApiSession(
    createApiClient({
      baseUrl: 'https://example.com/api/v1',
      fetch: async () =>
        new Response(JSON.stringify({ error: { code: 'NOT_IMPLEMENTED' } }), {
          status: 501,
        }),
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
  await session.restore();
  const resources = createLiveResources(session);
  await expect(
    resources.cards.load({}, new AbortController().signal),
  ).rejects.toMatchObject({ status: 501 });
  await expect(
    resources.home.fortune.load(new AbortController().signal),
  ).rejects.toMatchObject({ status: 501 });
});

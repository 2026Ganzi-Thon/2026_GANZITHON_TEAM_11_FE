import { expect, it } from '@jest/globals';
import { createApiClient } from './client';
import { createApiSession } from './session';
import { createLiveDecoration } from './decoration';
import { readDecoration } from '../features/decoration/model';

it('uses the server catalog assets and version for decoration and preserves them after saving', async () => {
  const sheep = {
    id: 'sheep-1',
    night_id: 'night-1',
    night_date: '2026-11-19',
    card_id: 'card-1',
    color_key: null,
    version: 3,
    placements: [],
  };
  let write: unknown;
  const api = createApiSession(
    createApiClient({
      baseUrl: 'https://example.com/api/v1',
      fetch: async (url, init) => {
        if (String(url).endsWith('/stickers') && init?.method === 'PUT') {
          write = JSON.parse(init.body as string);
          return new Response(
            JSON.stringify({
              ...sheep,
              version: 4,
              placements: (write as { placements: unknown[] }).placements,
            }),
          );
        }
        if (String(url).endsWith('/stickers'))
          return new Response(
            JSON.stringify({
              items: [
                {
                  id: 'server-star',
                  label: '별',
                  asset_url: 'https://assets.example.com/star.svg',
                },
              ],
            }),
          );
        return new Response(JSON.stringify({ sheep }));
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
  const source = createLiveDecoration(api);
  const data = readDecoration(
    await source.actions.load(sheep.id, new AbortController().signal),
    sheep.id,
  );
  expect(data.stickers).toEqual([
    {
      id: 'server-star',
      label: '별',
      asset_url: 'https://assets.example.com/star.svg',
    },
  ]);
  const placements = [
    {
      instance_id: 'p',
      sticker_id: 'server-star',
      x: 0.5,
      y: 0.5,
      rotation: 0,
      scale: 1,
    },
  ];
  const saved = await source.actions.save(
    sheep.id,
    { if_version: 3, placements },
    new AbortController().signal,
  );
  expect(write).toEqual({ if_version: 3, placements });
  expect(saved.sticker_assets).toEqual({
    'server-star': 'https://assets.example.com/star.svg',
  });
  expect(saved.version).toBe(4);
});

it('accepts an empty server catalog without inventing local stickers', () => {
  const value = readDecoration(
    {
      sheep: {
        id: 's',
        night_id: 'n',
        night_date: '2026-11-19',
        card_id: 'c',
        color_key: null,
        version: 1,
        placements: [],
      },
      stickers: [],
    },
    's',
  );
  expect(value.stickers).toEqual([]);
});

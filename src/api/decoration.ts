import type { ApiSession } from './session';
import { ApiError } from './errors';
import type { Sheep } from '../features/morning/types';
import type {
  DecorationActions,
  DecoratedSheep,
  Sticker,
} from '../features/decoration/types';

export function createLiveDecoration(api: ApiSession) {
  let catalog: Sticker[] | null = null;
  const loadCatalog = async (signal: AbortSignal): Promise<Sticker[]> => {
    const result = await api.request<{
      items: { id: string; label: string; asset_url: string }[];
    }>('/stickers', { signal });
    if (!Array.isArray(result.items) || result.items.length > 200)
      throw new ApiError('invalid-response');
    const items = result.items.map((item) => {
      if (
        !item.id?.trim() ||
        !item.label?.trim() ||
        typeof item.asset_url !== 'string'
      )
        throw new ApiError('invalid-response');
      try {
        if (new URL(item.asset_url).protocol !== 'https:') throw new Error();
      } catch {
        throw new ApiError('invalid-response');
      }
      return { id: item.id, label: item.label, asset_url: item.asset_url };
    });
    if (new Set(items.map((s) => s.id)).size !== items.length)
      throw new ApiError('invalid-response');
    catalog = items;
    return items;
  };
  const attach = <T extends Sheep>(sheep: T, items: Sticker[]): T => ({
    ...sheep,
    sticker_assets: Object.fromEntries(
      items.filter((s) => s.asset_url).map((s) => [s.id, s.asset_url!]),
    ),
  });
  const actions: DecorationActions = {
    async load(id, signal) {
      const [detail, items] = await Promise.all([
        api.request<{ sheep: DecoratedSheep }>(
          `/sheep/${encodeURIComponent(id)}`,
          { signal },
        ),
        loadCatalog(signal),
      ]);
      return { sheep: attach(detail.sheep, items), stickers: items };
    },
    async save(id, input, signal) {
      const items = catalog ?? (await loadCatalog(signal));
      const sheep = await api.request<DecoratedSheep>(
        `/sheep/${encodeURIComponent(id)}/stickers`,
        {
          method: 'PUT',
          body: {
            if_version: input.if_version,
            placements: input.placements.map((p) => ({ ...p })),
          },
          signal,
        },
      );
      return attach(sheep, items);
    },
  };
  return {
    actions,
    async withAssets<T extends Sheep>(
      sheep: T[],
      signal: AbortSignal,
    ): Promise<T[]> {
      if (!sheep.length) return [];
      if (!sheep.some((s) => s.placements?.length))
        return sheep.map((s) => attach(s, catalog ?? []));
      const items = catalog ?? (await loadCatalog(signal));
      return sheep.map((s) => attach(s, items));
    },
  };
}

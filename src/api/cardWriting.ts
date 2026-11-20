import type { ApiSession } from './session';
import { operationKey } from './session';
import type { Track } from './contracts';
import type {
  CardChoice,
  CardWritingActions,
} from '../features/cards/CardWritingScreen';
import type {
  TextCardDraft,
  TextCardSubmission,
} from '../features/cards/types';
import type {
  SongCardActions,
  SongCardDraft,
  SongCardInput,
  SongCardSubmission,
} from '../features/cards/songTypes';
import type {
  MyCardsWritingSource,
  RejectedSongCard,
  RejectedTextCard,
} from '../features/myCards/types';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
export function createLiveCardWriting(
  api: ApiSession,
  path = '/cards',
  initial?: RejectedSongCard,
): CardWritingActions {
  let choice: CardChoice | null = initial
    ? {
        kind: 'song',
        category_id: initial.category_id as CardChoice['category_id'],
      }
    : null;
  let text: TextCardDraft = {
    category_id: null,
    text: '',
    operationKey: operationKey(),
  };
  let song: SongCardDraft = {
    category_id: choice?.category_id ?? null,
    query: '',
    selection: initial
      ? { mode: 'search', track: initial.content.track }
      : null,
    recommendation: initial?.content.recommendation ?? '',
    operationKey: operationKey(),
  };
  const search: SongCardActions['search'] = async (query, signal) =>
    (
      await api.request<{ items: Track[] }>(
        `/music/search?q=${encodeURIComponent(query)}`,
        { signal },
      )
    ).items;
  return {
    readChoice: () => choice && { ...choice },
    choose: (value) => {
      choice = { ...value };
    },
    text: {
      readDraft: () => ({ ...text }),
      writeDraft(value) {
        const changed =
          value.category_id !== text.category_id ||
          value.text.trim() !== text.text.trim();
        text = {
          ...value,
          operationKey: changed ? operationKey() : text.operationKey,
        };
        return { ...text };
      },
      submit: (body, key, signal) =>
        api.request<TextCardSubmission>(path, {
          method: 'POST',
          body: JSON.parse(JSON.stringify(body)),
          idempotencyKey: key,
          signal,
        }),
    },
    song: {
      search,
      readDraft: () => clone(song),
      writeDraft(value: SongCardInput) {
        const { operationKey: key, ...previous } = song;
        song = {
          ...clone(value),
          operationKey:
            JSON.stringify(previous) === JSON.stringify(value)
              ? key
              : operationKey(),
        };
        return clone(song);
      },
      submit: (body, key, signal) =>
        api.request<SongCardSubmission>(path, {
          method: 'POST',
          body: JSON.parse(JSON.stringify(body)),
          idempotencyKey: key,
          signal,
        }),
    },
  };
}
export function createLiveMyCards(api: ApiSession): MyCardsWritingSource {
  const drafts = new Map<string, TextCardDraft>();
  const songs = new Map<string, SongCardActions>();
  const readDraft = (item: RejectedTextCard): TextCardDraft => {
    let draft = drafts.get(item.id);
    if (!draft) {
      draft = {
        category_id: item.category_id as TextCardDraft['category_id'],
        text: item.content.text,
        operationKey: operationKey(),
      };
      drafts.set(item.id, draft);
    }
    return { ...draft };
  };
  return {
    load: (query, signal) => {
      const params = new URLSearchParams();
      if (query.status) params.set('status', query.status);
      if (query.cursor) params.set('cursor', query.cursor);
      return api.request(`/me/cards?${params}`, { signal });
    },
    remove: (id, signal) =>
      api.request(`/me/cards/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        signal,
      }),
    createWritingSession: () => createLiveCardWriting(api),
    readDraft,
    writeDraft(id, value) {
      const old = drafts.get(id);
      const changed =
        old?.text.trim() !== value.text.trim() ||
        old?.category_id !== value.category_id;
      const next = {
        ...value,
        operationKey: changed ? operationKey() : old!.operationKey,
      };
      drafts.set(id, next);
      return { ...next };
    },
    clearDraft: (id) => {
      drafts.delete(id);
    },
    resubmit: (id, body, key, signal) =>
      api.request(`/me/cards/${encodeURIComponent(id)}/resubmit`, {
        method: 'POST',
        body: JSON.parse(JSON.stringify(body)),
        idempotencyKey: key,
        signal,
      }),
    createSongResubmitSession(item) {
      if (!songs.has(item.id))
        songs.set(
          item.id,
          createLiveCardWriting(
            api,
            `/me/cards/${encodeURIComponent(item.id)}/resubmit`,
            item,
          ).song,
        );
      return songs.get(item.id)!;
    },
  };
}

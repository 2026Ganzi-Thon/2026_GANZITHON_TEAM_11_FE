import { ApiError } from '../api/errors';
import type { Track } from '../api/contracts';
import { categories } from '../features/night/categories';
import {
  PREVIEW_RECOMMENDATION_LIMIT,
  trimmedLength,
  type SongCardActions,
  type SongCardSubmission,
} from '../features/cards/songTypes';
import type { RejectedSongCard, Submission } from '../features/myCards/types';
import { createMockSongCards } from './songCards';
import { createMockSupport } from './support';
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
/** One rejected card/revision owns its draft and replay history, independently of new writing. */
export function createMockSongResubmission(
  item: RejectedSongCard,
  options: {
    scenario: string;
    current: () => Submission | null;
    accept: (receipt: SongCardSubmission) => void;
    request: <T>(signal: AbortSignal, job: () => T) => Promise<T>;
  },
): SongCardActions {
  const { scenario, current, accept, request } = options;
  const editing = createMockSongCards(
    scenario === 'empty-search' ? 'empty' : 'success',
    {
      namespace: `resubmit-${item.id}-${item.revision}`,
    },
  );
  const knownTracks = new Map<string, Track>([
    [item.content.track.id, clone(item.content.track)],
  ]);
  editing.writeDraft({
    category_id: categories.some(
      (c) => c.id !== 'none' && c.id === item.category_id,
    )
      ? (item.category_id as NonNullable<
          ReturnType<typeof editing.readDraft>['category_id']
        >)
      : null,
    query: '',
    selection: { mode: 'search', track: clone(item.content.track) },
    recommendation: item.content.recommendation ?? '',
  });
  const accepted = new Map<
    string,
    { body: string; receipt: SongCardSubmission }
  >();
  const failures = new Set<string>();
  return {
    readDraft: editing.readDraft,
    writeDraft: editing.writeDraft,
    async search(query, signal) {
      const tracks = await editing.search(query, signal);
      tracks.forEach((track) => knownTracks.set(track.id, clone(track)));
      return tracks;
    },
    submit: (body, key, signal) =>
      request(signal, () => {
        const serialized = JSON.stringify(body),
          previous = accepted.get(key);
        if (previous) {
          if (previous.body !== serialized)
            throw new ApiError('http', {
              status: 409,
              code: 'IDEMPOTENCY_CONFLICT',
            });
          return clone(previous.receipt);
        }
        const latest = current();
        if (!latest)
          throw new ApiError('http', { status: 404, code: 'CARD_NOT_FOUND' });
        if (latest.kind !== 'song' || latest.moderation_status !== 'rejected')
          throw new ApiError('http', {
            status: 409,
            code: 'CARD_NOT_REJECTED',
          });
        if (accepted.size > 0)
          throw new ApiError('http', {
            status: 409,
            code: 'CARD_NOT_REJECTED',
          });
        if (
          body.source_night_id !== undefined ||
          !categories.some((c) => c.id !== 'none' && c.id === body.category_id)
        )
          throw new ApiError('http', {
            status: 422,
            fields: { category_id: '고민 분류를 다시 골라 주세요.' },
          });
        const manual = body.content.manual_track;
        const track = manual
          ? {
              id: `resubmit-manual-${item.id}`,
              title: manual.title.trim(),
              artist: manual.artist.trim(),
              cover_url: null,
              spotify_search_url: '',
            }
          : knownTracks.get(body.content.track_id);
        if (!track || !!manual === !!body.content.track_id)
          throw new ApiError('http', {
            status: 422,
            code: 'TRACK_NOT_FOUND',
            fields: { track: '곡을 다시 골라 주세요.' },
          });
        if (
          manual &&
          ![manual.title, manual.artist].every(
            (v) => trimmedLength(v) > 0 && trimmedLength(v) <= 200,
          )
        )
          throw new ApiError('http', {
            status: 422,
            fields: { track: '제목과 가수를 1~200자로 적어 주세요.' },
          });
        if (
          !trimmedLength(body.content.recommendation) ||
          trimmedLength(body.content.recommendation) >
            PREVIEW_RECOMMENDATION_LIMIT
        )
          throw new ApiError('http', {
            status: 422,
            fields: {
              'content.recommendation': '추천 문장을 1~50자로 적어 주세요.',
            },
          });
        if (!failures.has('first')) {
          failures.add('first');
          if (scenario === 'resubmit-retry') throw new ApiError('network');
          if (scenario === 'resubmit-field')
            throw new ApiError('http', {
              status: 422,
              fields: {
                'content.recommendation':
                  '추천 문장을 본인의 말로 적어 주세요.',
              },
            });
          if (scenario === 'resubmit-category-field')
            throw new ApiError('http', {
              status: 422,
              fields: { category_id: '고민 분류를 다시 골라 주세요.' },
            });
          if (scenario === 'resubmit-safety')
            throw new ApiError('http', {
              status: 503,
              code: 'SAFETY_CHECK_UNAVAILABLE',
            });
          if (scenario === 'resubmit-support')
            throw new ApiError('http', {
              status: 422,
              code: 'SUPPORT_RECOMMENDED',
              support: createMockSupport(),
            });
        }
        const receipt: SongCardSubmission = {
          id: item.id,
          kind: 'song',
          category_id: body.category_id,
          content: {
            track: clone(track),
            recommendation: body.content.recommendation.trim(),
          },
          moderation_status: 'pending',
        };
        accept(clone(receipt));
        accepted.set(key, { body: serialized, receipt });
        if (scenario === 'lost-resubmit' && !failures.has('lost')) {
          failures.add('lost');
          throw new ApiError('network');
        }
        return clone(receipt);
      }),
  };
}

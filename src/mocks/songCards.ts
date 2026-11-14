import { ApiError } from '../api/errors';
import type { Track } from '../api/contracts';
import { categories } from '../features/night/categories';
import {
  PREVIEW_RECOMMENDATION_LIMIT,
  trimmedLength,
  type SongCardActions,
  type SongCardDraft,
  type SongCardInput,
  type SongCardSubmission,
} from '../features/cards/songTypes';
export type SongCardScenario =
  | 'success'
  | 'empty'
  | 'search-retry'
  | 'slow-search'
  | 'retry'
  | 'lost-response'
  | 'field-error'
  | 'support'
  | 'safety-unavailable'
  | 'entry-required'
  | 'slow-submit'
  | 'long';
const tracks: Track[] = [
  {
    id: 'preview-track-1',
    title: '밤편지',
    artist: '아이유',
    cover_url: null,
    spotify_search_url: '',
  },
  {
    id: 'preview-track-2',
    title: '밤편지 (Live)',
    artist: '아이유',
    cover_url: null,
    spotify_search_url: '',
  },
  {
    id: 'preview-track-3',
    title: '밤의 편지',
    artist: '다른 가수',
    cover_url: null,
    spotify_search_url: '',
  },
];
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const fingerprint = (d: SongCardInput) =>
  JSON.stringify([
    d.category_id,
    d.selection?.mode === 'search'
      ? d.selection.track.id
      : d.selection
        ? [d.selection.title.trim(), d.selection.artist.trim()]
        : null,
    d.recommendation.trim(),
  ]);
/** Fixed fixtures only: never calls a music provider or classifies the submitted text. */
export function createMockSongCards(
  scenario: SongCardScenario = 'success',
  {
    sourceNightId = 'preview-night',
    canSubmit = () => true,
    onSubmitted = () => {},
    namespace = 'preview',
  }: {
    sourceNightId?: string | null;
    canSubmit?: () => boolean;
    onSubmitted?: (receipt: SongCardSubmission) => void;
    namespace?: string;
  } = {},
): SongCardActions {
  let version = 0;
  let draft: SongCardDraft = {
    category_id: null,
    query: '',
    selection: null,
    recommendation: '',
    operationKey: `${namespace}-song-0`,
  };
  const catalog =
    scenario === 'long'
      ? tracks.map((t) => ({
          ...t,
          title:
            '잠들지 못한 아주 긴 밤에 마음을 내려놓고 천천히 쉬어 가도 괜찮다는 노래',
          artist: '이름이 아주 긴 예시 아티스트와 친구들',
        }))
      : tracks;
  const failures = new Set<string>();
  const accepted = new Map<
    string,
    { body: string; receipt: SongCardSubmission }
  >();
  function delayed<T>(signal: AbortSignal, run: () => T, ms = 400): Promise<T> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new ApiError('aborted'));
        return;
      }
      const cleanup = () => {
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
      };
      const abort = () => {
        cleanup();
        reject(new ApiError('aborted'));
      };
      const timer = setTimeout(() => {
        cleanup();
        try {
          resolve(run());
        } catch (e) {
          reject(e);
        }
      }, ms);
      signal.addEventListener('abort', abort, { once: true });
    });
  }
  return {
    readDraft: () => clone(draft),
    writeDraft(value) {
      if (fingerprint(value) !== fingerprint(draft)) version++;
      draft = clone({ ...value, operationKey: `${namespace}-song-${version}` });
      return clone(draft);
    },
    search: (query, signal) =>
      delayed(
        signal,
        () => {
          if (!trimmedLength(query) || trimmedLength(query) > 100)
            throw new ApiError('http', {
              status: 422,
              fields: { q: '검색어는 1~100자로 적어 주세요.' },
            });
          if (scenario === 'search-retry' && !failures.has('search')) {
            failures.add('search');
            throw new ApiError('http', {
              status: 503,
              code: 'MUSIC_SEARCH_UNAVAILABLE',
            });
          }
          if (scenario === 'empty') return [];
          return clone(catalog);
        },
        scenario === 'slow-search' ? 2000 : 400,
      ),
    submit: (body, key, signal) =>
      delayed(
        signal,
        () => {
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
          if (
            accepted.size > 0 ||
            body.source_night_id !== (sourceNightId ?? undefined) ||
            !canSubmit() ||
            scenario === 'entry-required'
          )
            throw new ApiError('http', {
              status: 409,
              code: 'WRITING_ENTRY_REQUIRED',
            });
          if (
            !categories.some(
              (c) => c.id !== 'none' && c.id === body.category_id,
            )
          )
            throw new ApiError('http', {
              status: 422,
              fields: { category_id: '고민 분류를 다시 골라 주세요.' },
            });
          const manual = body.content.manual_track;
          const track = manual
            ? {
                id: 'preview-manual-track',
                title: manual.title.trim(),
                artist: manual.artist.trim(),
                cover_url: null,
                spotify_search_url: '',
              }
            : catalog.find((t) => t.id === body.content.track_id);
          if (!track || !!manual === !!body.content.track_id)
            throw new ApiError('http', {
              status: 422,
              code: 'TRACK_NOT_FOUND',
            });
          if (
            manual &&
            ![manual.title, manual.artist].every(
              (v) => trimmedLength(v) > 0 && trimmedLength(v) <= 200,
            )
          )
            throw new ApiError('http', {
              status: 422,
              fields: {
                'content.manual_track': '제목과 가수를 1~200자로 적어 주세요.',
              },
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
          if (!failures.has('submit')) {
            failures.add('submit');
            if (scenario === 'retry') throw new ApiError('network');
            if (scenario === 'field-error')
              throw new ApiError('http', {
                status: 422,
                fields: {
                  'content.recommendation':
                    '추천 문장을 본인의 말로 적어 주세요.',
                },
              });
            if (scenario === 'support')
              throw new ApiError('http', {
                status: 422,
                code: 'SUPPORT_RECOMMENDED',
                serverMessage: '지금은 잠시 쉬어 가도 괜찮아요.',
              });
            if (scenario === 'safety-unavailable')
              throw new ApiError('http', {
                status: 503,
                code: 'SAFETY_CHECK_UNAVAILABLE',
              });
          }
          const receipt: SongCardSubmission = {
            id: `${namespace}-song-card-${accepted.size + 1}`,
            kind: 'song',
            category_id: body.category_id,
            content: {
              track: clone(track),
              recommendation: body.content.recommendation,
            },
            moderation_status: 'pending',
          };
          accepted.set(key, { body: serialized, receipt });
          onSubmitted(clone(receipt));
          if (scenario === 'lost-response' && !failures.has('lost')) {
            failures.add('lost');
            throw new ApiError('network');
          }
          return clone(receipt);
        },
        scenario === 'slow-submit' ? 5000 : 400,
      ),
  };
}

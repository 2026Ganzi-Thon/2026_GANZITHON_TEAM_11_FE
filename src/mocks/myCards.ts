import { ApiError } from '../api/errors';
import { createMockTextCards } from './textCards';
import { createMockSongCards } from './songCards';
import { createMockCardWriting } from './cardWriting';
import type { TextCardSubmission } from '../features/cards/types';
import type { SongCardSubmission } from '../features/cards/songTypes';
import type {
  MyCardsWritingSource,
  Submission,
} from '../features/myCards/types';

export type MyCardsScenario =
  | 'success'
  | 'empty'
  | 'load-retry'
  | 'more-retry'
  | 'slow'
  | 'long'
  | 'delete-retry'
  | 'slow-delete'
  | 'lost-delete'
  | 'delete-refresh-retry'
  | 'single'
  | 'write-retry'
  | 'write-lost-response'
  | 'write-refresh-retry'
  | 'write-slow'
  | 'write-empty-search';
export function createMockMyCards(
  scenario: MyCardsScenario = 'success',
): MyCardsWritingSource {
  const base = {
    category_id: 'career',
    rejection_reason: null,
    yarn_count: 0,
    revision: 1,
  };
  const track = {
    id: 'my-track',
    title: '밤편지',
    artist: '아이유',
    cover_url: null,
    spotify_search_url: '',
  };
  const records: Submission[] =
    scenario === 'empty'
      ? []
      : [
          {
            ...base,
            id: 'my-text-1',
            kind: 'text',
            content: {
              text: '나도 결과 기다리는 밤이 제일 길었어. 오늘은 잠깐 쉬어 가도 괜찮아.',
            },
            moderation_status: 'approved',
            yarn_count: 12,
            created_at: '2026-11-07T01:00:00Z',
          },
          {
            ...base,
            id: 'my-song-2',
            kind: 'song',
            content: {
              track,
              recommendation: '복잡한 하루를 마치고 들었어요.',
            },
            moderation_status: 'pending',
            created_at: '2026-11-06T01:00:00Z',
          },
          {
            ...base,
            id: 'my-text-3',
            kind: 'text',
            content: {
              text: '나도 결과 기다리는 밤이 제일 길었어. 궁금하면 함께 이야기해요.',
            },
            moderation_status: 'rejected',
            rejection_reason:
              '개인 연락을 유도하는 문장을 빼고, 본인의 경험으로 다시 적어 주세요.',
            created_at: '2026-11-05T01:00:00Z',
          },
          {
            ...base,
            id: 'my-text-4',
            kind: 'text',
            content: { text: '내 속도로 걸어도 괜찮아요.' },
            moderation_status: 'pending',
            created_at: '2026-11-04T01:00:00Z',
          },
          {
            ...base,
            id: 'my-song-5',
            kind: 'song',
            content: {
              track: {
                ...track,
                id: 'other-track',
                title: '쉬어 가는 밤',
                artist: '예시 가수',
              },
              recommendation: '오늘은 이 노래와 함께 쉬어 가요.',
            },
            moderation_status: 'approved',
            yarn_count: 3,
            created_at: '2026-11-03T01:00:00Z',
          },
        ];
  if (scenario === 'single') records.splice(1);
  if (scenario === 'long') {
    records[0] = {
      ...records[0],
      kind: 'text',
      content: {
        text: '오늘 해야 할 일을 다 끝내지 못해도 괜찮아요. 내일의 나에게 잠깐 맡기고 쉬어 가요. '.repeat(
          4,
        ),
      },
    };
    records[1] = {
      ...records[1],
      kind: 'song',
      content: {
        track: {
          ...track,
          title: '잠들지 못한 긴 밤에 천천히 마음을 내려놓아도 괜찮다는 노래',
          artist: '이름이 아주 긴 예시 아티스트와 친구들',
        },
        recommendation: '긴 하루를 보낸 모두에게 보내요.',
      },
    };
    records[2].rejection_reason =
      '특정 사람을 알아볼 수 있는 정보와 외부 연락을 유도하는 문장을 빼 주세요. '.repeat(
        6,
      );
  }
  const failures = new Set<string>();
  const deleted = new Set<string>();
  let refreshFailure = false;
  let writingSession = 0;
  function request<T>(
    signal: AbortSignal,
    key: 'load' | 'more' | 'delete',
    job: () => T,
  ): Promise<T> {
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
      const timer = setTimeout(
        () => {
          cleanup();
          try {
            if (scenario === `${key}-retry` && !failures.has(key)) {
              failures.add(key);
              throw new ApiError('network');
            }
            resolve(job());
          } catch (error) {
            reject(error);
          }
        },
        scenario === 'slow-delete' && key === 'delete'
          ? 5000
          : scenario === 'slow'
            ? 2500
            : 400,
      );
      signal.addEventListener('abort', abort, { once: true });
    });
  }
  return {
    createWritingSession() {
      let fulfilled = false;
      const namespace = `my-writing-${String(++writingSession).padStart(6, '0')}`;
      const onSubmitted = (
        receipt: TextCardSubmission | SongCardSubmission,
      ) => {
        if (fulfilled) return;
        fulfilled = true;
        records.unshift({
          ...receipt,
          rejection_reason: null,
          yarn_count: 0,
          revision: 1,
          created_at: new Date().toISOString(),
        });
        if (scenario === 'write-refresh-retry') refreshFailure = true;
      };
      const options = {
        sourceNightId: null,
        namespace,
        canSubmit: () => !fulfilled,
        onSubmitted,
      };
      const writingScenario =
        scenario === 'write-retry'
          ? 'retry'
          : scenario === 'write-lost-response'
            ? 'lost-response'
            : 'success';
      return createMockCardWriting(
        createMockTextCards(writingScenario, {
          ...options,
          delayMs: scenario === 'write-slow' ? 5000 : 400,
        }),
        createMockSongCards(
          scenario === 'write-slow'
            ? 'slow-submit'
            : scenario === 'write-empty-search'
              ? 'empty'
              : writingScenario,
          options,
        ),
      );
    },
    load: (query, signal) =>
      request(signal, query.cursor ? 'more' : 'load', () => {
        if (refreshFailure) {
          refreshFailure = false;
          throw new ApiError('network');
        }
        const items = records
          .filter(
            (item) =>
              !deleted.has(item.id) &&
              (!query.status || item.moderation_status === query.status),
          )
          .sort(
            (a, b) =>
              b.created_at.localeCompare(a.created_at) ||
              (a.id < b.id ? 1 : a.id > b.id ? -1 : 0),
          );
        const offset = query.cursor ? Number(query.cursor) : 0;
        if (!Number.isInteger(offset) || offset < 0 || offset > items.length)
          throw new ApiError('http', { status: 422, code: 'INVALID_CURSOR' });
        return {
          items: items.slice(offset, offset + 3),
          next_cursor: offset + 3 < items.length ? String(offset + 3) : null,
        };
      }),
    remove: (id, signal) =>
      request(signal, 'delete', () => {
        if (!records.some((item) => item.id === id))
          throw new ApiError('http', { status: 404, code: 'CARD_NOT_FOUND' });
        deleted.add(id);
        if (scenario === 'lost-delete' && !failures.has('lost-delete')) {
          failures.add('lost-delete');
          throw new ApiError('network');
        }
        if (scenario === 'delete-refresh-retry') refreshFailure = true;
      }),
  };
}

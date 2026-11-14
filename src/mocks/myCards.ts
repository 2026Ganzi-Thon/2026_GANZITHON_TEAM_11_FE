import { ApiError } from '../api/errors';
import { categories } from '../features/night/categories';
import { createMockTextCards } from './textCards';
import { createMockSongCards } from './songCards';
import { createMockCardWriting } from './cardWriting';
import {
  PREVIEW_TEXT_CARD_LIMIT,
  textCardLength,
  type TextCardDraft,
  type TextCardSubmission,
} from '../features/cards/types';
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
  | 'resubmit-retry'
  | 'lost-resubmit'
  | 'slow-resubmit'
  | 'resubmit-approved'
  | 'resubmit-deleted'
  | 'resubmit-field'
  | 'resubmit-category-field'
  | 'resubmit-safety'
  | 'resubmit-support'
  | 'resubmit-refresh-retry'
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
  const drafts = new Map<string, TextCardDraft>();
  const accepted = new Map<
    string,
    { fingerprint: string; receipt: TextCardSubmission }
  >();
  let draftVersion = 0;
  const fingerprint = (value: Pick<TextCardDraft, 'category_id' | 'text'>) =>
    JSON.stringify([value.category_id, value.text.trim()]);
  const failures = new Set<string>();
  const deleted = new Set<string>();
  let refreshFailure = false;
  let writingSession = 0;
  function request<T>(
    signal: AbortSignal,
    key: 'load' | 'more' | 'delete' | 'resubmit',
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
        (scenario === 'slow-delete' && key === 'delete') ||
          (scenario === 'slow-resubmit' && key === 'resubmit')
          ? 5000
          : scenario === 'slow'
            ? 2500
            : 400,
      );
      signal.addEventListener('abort', abort, { once: true });
    });
  }
  return {
    readDraft(item) {
      const previous = drafts.get(item.id);
      if (previous) return { ...previous };
      const draft: TextCardDraft = {
        text: item.content.text,
        category_id: categories.some(
          (c) => c.id !== 'none' && c.id === item.category_id,
        )
          ? (item.category_id as TextCardDraft['category_id'])
          : null,
        operationKey: `resubmit-${item.id}-${draftVersion++}`,
      };
      drafts.set(item.id, draft);
      return { ...draft };
    },
    writeDraft(id, value) {
      const previous = drafts.get(id);
      const draft = {
        ...value,
        operationKey:
          previous && fingerprint(previous) === fingerprint(value)
            ? previous.operationKey
            : `resubmit-${id}-${draftVersion++}`,
      };
      drafts.set(id, draft);
      return { ...draft };
    },
    clearDraft(id) {
      drafts.delete(id);
    },
    resubmit: (id, body, key, signal) =>
      request(signal, 'resubmit', () => {
        const operation = JSON.stringify([id, key]);
        const payload = JSON.stringify(body);
        const copy = (receipt: TextCardSubmission): TextCardSubmission => ({
          ...receipt,
          content: { ...receipt.content },
        });
        const previous = accepted.get(operation);
        if (previous) {
          if (previous.fingerprint !== payload)
            throw new ApiError('http', {
              status: 409,
              code: 'IDEMPOTENCY_CONFLICT',
            });
          return copy(previous.receipt);
        }
        const index = records.findIndex((item) => item.id === id);
        if (scenario === 'resubmit-deleted') deleted.add(id);
        if (index < 0 || deleted.has(id))
          throw new ApiError('http', { status: 404, code: 'CARD_NOT_FOUND' });
        const item = records[index];
        if (scenario === 'resubmit-approved')
          records[index] = {
            ...item,
            moderation_status: 'approved',
            rejection_reason: null,
          };
        if (records[index].moderation_status !== 'rejected')
          throw new ApiError('http', {
            status: 409,
            code: 'CARD_NOT_REJECTED',
          });
        if (
          item.kind !== 'text' ||
          body.kind !== 'text' ||
          !categories.some((c) => c.id !== 'none' && c.id === body.category_id)
        )
          throw new ApiError('http', {
            status: 422,
            fields: { category_id: '고민 분류를 다시 골라 주세요.' },
          });
        if (
          !textCardLength(body.content.text) ||
          textCardLength(body.content.text) > PREVIEW_TEXT_CARD_LIMIT
        )
          throw new ApiError('http', {
            status: 422,
            fields: { 'content.text': '1~200자로 적어 주세요.' },
          });
        if (!failures.has('resubmit-fixture')) {
          failures.add('resubmit-fixture');
          if (scenario === 'resubmit-field')
            throw new ApiError('http', {
              status: 422,
              fields: { 'content.text': '글 내용을 다시 확인해 주세요.' },
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
              serverMessage: '지금은 잠시 쉬어 가도 괜찮아요.',
            });
        }
        const receipt: TextCardSubmission = {
          id,
          kind: 'text',
          category_id: body.category_id,
          content: { text: body.content.text.trim() },
          moderation_status: 'pending',
        };
        records[index] = {
          ...item,
          ...receipt,
          revision: item.revision + 1,
          rejection_reason: null,
        };
        accepted.set(operation, { fingerprint: payload, receipt });
        if (scenario === 'resubmit-refresh-retry') refreshFailure = true;
        if (scenario === 'lost-resubmit' && !failures.has('lost-resubmit')) {
          failures.add('lost-resubmit');
          throw new ApiError('network');
        }
        return copy(receipt);
      }),
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

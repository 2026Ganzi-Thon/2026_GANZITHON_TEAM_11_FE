import { ApiError } from '../api/errors';
import type { SettingsActions, WorryRecord } from '../features/settings/types';
export type SettingsScenario =
  | 'success'
  | 'empty'
  | 'profile-retry'
  | 'list-retry'
  | 'more-retry'
  | 'slow'
  | 'long'
  | 'paged';
type StoredRecord = Omit<WorryRecord, 'worry_text'> & {
  worry_text: string | null;
};
/** Fixed account samples and read-only pages. No account or worry mutations. */
export function createMockSettings(
  scenario: SettingsScenario = 'success',
): SettingsActions {
  const records: StoredRecord[] = [
    {
      night_id: 'preview-night',
      night_date: '2026-11-10',
      category_id: 'career',
      worry_text:
        scenario === 'long'
          ? '내일의 일을 생각하느라 잠이 오지 않아요. '.repeat(15)
          : '면접 결과가 내일 나오는데 계속 생각나서 잠이 안 와요.',
      reflection: {
        answer: 'same',
        message: '그럴 수 있어. 오늘 밤에 같은 고민 다시 들고 와도 돼.',
      },
    },
    {
      night_id: 'preview-earlier-0',
      night_date: '2026-11-09',
      category_id: 'romance',
      worry_text: '연락이 뜸해진 게 자꾸 신경 쓰여요.',
      reflection: { answer: 'smaller', message: '봐, 밤엔 커 보였던 거야.' },
    },
    {
      night_id: 'preview-earlier-1',
      night_date: '2026-11-08',
      category_id: 'study',
      worry_text: '시험을 앞두고 마음이 복잡해요.',
      reflection: null,
    },
    {
      night_id: 'preview-no-worry',
      night_date: '2026-11-07',
      category_id: 'none',
      worry_text: null,
      reflection: null,
    },
    {
      night_id: 'preview-deleted',
      night_date: '2026-11-06',
      category_id: 'career',
      worry_text: null,
      reflection: { answer: 'smaller', message: '원문 없이 남은 회고' },
    },
  ];
  const visible = () =>
    scenario === 'empty'
      ? []
      : records
          .filter(
            (r): r is WorryRecord =>
              r.category_id !== 'none' && !!r.worry_text?.trim(),
          )
          .sort(
            (a, b) =>
              b.night_date.localeCompare(a.night_date) ||
              b.night_id.localeCompare(a.night_id),
          );
  const failed = new Set<string>();
  function delayed<T>(
    signal: AbortSignal,
    key: string,
    action: () => T,
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
            if (
              ((scenario === 'profile-retry' && key === 'me') ||
                (scenario === 'list-retry' && key === 'first') ||
                (scenario === 'more-retry' && key === 'more')) &&
              !failed.has(key)
            ) {
              failed.add(key);
              throw new ApiError('network');
            }
            resolve(action());
          } catch (error) {
            reject(error);
          }
        },
        scenario === 'slow' ? 5000 : 500,
      );
      signal.addEventListener('abort', abort, { once: true });
    });
  }
  return {
    loadMe: (signal) =>
      delayed(signal, 'me', () => ({
        user: {
          id: 'settings-user',
          email:
            scenario === 'long'
              ? 'a.long.email.address.for.readability@example.com'
              : 'yang@example.com',
          birth_date: '2004-05-14',
          birth_date_edits_remaining: 1,
          stats: {
            night_count: 66,
            counted_sheep_total: 658,
            worry_record_count: visible().length,
          },
        },
        reminder: { enabled: false, local_time: null },
      })),
    worries: {
      load: (query, signal) =>
        delayed(signal, query.cursor ? 'more' : 'first', () => {
          if (query.cursor !== undefined && query.cursor !== 'settings-page-2')
            throw new ApiError('http', { status: 422, code: 'INVALID_CURSOR' });
          const all = visible();
          const paged = scenario === 'paged' || scenario === 'more-retry';
          const start = query.cursor ? 2 : 0;
          return {
            items: (paged ? all.slice(start, start + 2) : all).map((item) => ({
              ...item,
              reflection: item.reflection ? { ...item.reflection } : null,
            })),
            next_cursor:
              paged && start === 0 && all.length > 2 ? 'settings-page-2' : null,
          };
        }),
    },
  };
}

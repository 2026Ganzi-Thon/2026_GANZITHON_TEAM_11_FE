import type { SheepDetail, SheepDetailLoad } from '../features/flock/types';
import { ApiError } from '../api/errors';
export type DetailScenario =
  | 'success'
  | 'retry'
  | 'missing'
  | 'unavailable'
  | 'no-worry'
  | 'deleted-worry'
  | 'reflection'
  | 'long'
  | 'closing';
/** Delayed read from preview memory. No ownership or network checks are implemented here. */
export function createMockSheepDetail(
  find: (id: string) => SheepDetail | null,
  scenario: DetailScenario = 'success',
): SheepDetailLoad {
  const failed = new Set<string>();
  return (id, signal) =>
    new Promise((resolve, reject) => {
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
          if (scenario === 'retry' && !failed.has(id)) {
            failed.add(id);
            throw new ApiError('network');
          }
          const original = find(id);
          if (!original || scenario === 'missing')
            throw new ApiError('http', { status: 404, code: 'NOT_FOUND' });
          const detail: SheepDetail = {
            ...original,
            night: { ...original.night },
          };
          if (scenario === 'unavailable')
            detail.card = { ...detail.card, available: false, content: null };
          if (scenario === 'deleted-worry') {
            detail.night.worry_text = null;
          }
          if (scenario === 'no-worry') {
            detail.night.category_id = 'none';
            detail.night.worry_text = null;
            detail.night.reflection = null;
          }
          if (scenario === 'reflection')
            detail.night.reflection = {
              answer: 'smaller',
              message: '봐, 밤엔 커 보였던 거야.',
            };
          if (scenario === 'closing') {
            detail.position = null;
            detail.sheep_count = null;
          }
          if (scenario === 'long') {
            detail.card = {
              ...detail.card,
              kind: 'text',
              content: {
                text: '지금은 잠깐 쉬어 가도 괜찮아. 네가 걸어온 작은 걸음들을 기억해. '.repeat(
                  12,
                ),
              },
            };
            detail.night.worry_text =
              '내일의 일을 생각하느라 잠이 오지 않아요. '.repeat(12);
            detail.night.reflection = {
              answer: 'smaller',
              message: '오늘은 조금 가벼워졌구나.',
            };
          }
          resolve(detail);
        } catch (error) {
          reject(error);
        }
      }, 600);
      signal.addEventListener('abort', abort, { once: true });
    });
}

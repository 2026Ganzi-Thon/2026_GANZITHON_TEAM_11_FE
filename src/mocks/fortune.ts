import { ApiError } from '../api/errors';
import type { Fortune, FortuneActions } from '../features/fortune/types';
export type FortuneScenario =
  | 'success'
  | 'first'
  | 'second'
  | 'favorable'
  | 'relaxed'
  | 'resting'
  | 'retry'
  | 'unavailable'
  | 'slow'
  | 'long'
  | 'next-day';
/** Fixed daily examples, not fortune generation, birth-date calculation or a clock. */
export function createMockFortune(
  scenario: FortuneScenario = 'success',
): FortuneActions {
  const type =
    scenario === 'favorable' || scenario === 'relaxed' || scenario === 'resting'
      ? scenario
      : 'sparkling';
  const fortune: Fortune = {
    date: scenario === 'next-day' ? '2026-11-15' : '2026-11-14',
    zodiac: scenario === 'next-day' ? 'gemini' : 'taurus',
    rank:
      type === 'sparkling'
        ? scenario === 'first'
          ? 1
          : scenario === 'second'
            ? 2
            : 3
        : null,
    sheep_type: type,
    message:
      type === 'resting'
        ? '나를 챙기기 좋은 날. 오늘은 일찍 누워 볼까?'
        : type === 'relaxed'
          ? '천천히 가도 괜찮은 날. 점심은 좋아하는 걸로'
          : type === 'favorable'
            ? '일이 술술 풀리는 날. 미뤄 둔 연락 하나 해 볼까?'
            : scenario === 'long'
              ? '하고 싶던 일을 시작하기 좋은 날이야. '.repeat(12)
              : '하고 싶던 일을 시작하기 좋은 날이야',
    lucky_color:
      scenario === 'long' ? '햇살을 닮은 부드럽고 따뜻한 연두색' : '연두',
    lucky_item:
      scenario === 'long' ? '가방 안에 넣어 둔 작고 부드러운 손수건' : '손수건',
    small_action:
      scenario === 'long'
        ? '오늘은 나를 위한 시간을 잠깐 내어 좋아하는 노래 한 곡을 들어 봐요. '.repeat(
            5,
          )
        : '미뤄 둔 연락 하나 해 볼까?',
  };
  let failed = false;
  return {
    load: (signal) =>
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
        const timer = setTimeout(
          () => {
            cleanup();
            if (scenario === 'unavailable') {
              reject(
                new ApiError('http', {
                  status: 503,
                  code: 'FORTUNE_UNAVAILABLE',
                }),
              );
              return;
            }
            if (scenario === 'retry' && !failed) {
              failed = true;
              reject(new ApiError('network'));
              return;
            }
            resolve({ ...fortune });
          },
          scenario === 'slow' ? 5000 : 400,
        );
        signal.addEventListener('abort', abort, { once: true });
      }),
  };
}

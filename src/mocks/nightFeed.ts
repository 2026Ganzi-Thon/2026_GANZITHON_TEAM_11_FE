import type { Card } from '../api/contracts';
import { ApiError } from '../api/errors';
import type { FeedLoad } from '../features/night/feed/model';
export type FeedScenario =
  'success' | 'retry' | 'empty' | 'long' | 'unavailable';
const viewer = { yarn_sent: false, fluff_saved: false, song_saved: false };
const sampleCards: Card[] = [
  {
    id: 'example-empathy',
    kind: 'text',
    tone: 'empathy',
    category_id: 'career',
    author_type: 'seed',
    author_label: '먼저 지나간 양',
    available: true,
    viewer,
    content: {
      text: '나도 결과 기다리는 밤이 제일 길었어. 기다리는 동안 너는 이미 할 만큼 한 거야.',
    },
  },
  {
    id: 'example-light',
    kind: 'text',
    tone: 'light',
    category_id: null,
    author_type: 'editorial',
    author_label: '놀러온 양',
    available: true,
    viewer,
    content: {
      text: '오늘의 할 일 목록에 쉬는 시간도 적어 두면 어때? 아무것도 하지 않는 시간도 네 시간이니까.',
    },
  },
  {
    id: 'example-auto-song',
    kind: 'song',
    tone: null,
    category_id: 'career',
    author_type: 'ai',
    author_label: null,
    available: true,
    viewer,
    content: {
      track: {
        id: 'example-track-1',
        title: '밤의 산책 (예시)',
        artist: '예시 아티스트',
        cover_url: null,
        spotify_search_url: '',
      },
      recommendation: null,
    },
  },
  {
    id: 'example-user-song',
    kind: 'song',
    tone: null,
    category_id: 'study',
    author_type: 'user',
    author_label: '먼저 지나간 양',
    available: true,
    viewer,
    content: {
      track: {
        id: 'example-track-2',
        title: '잠깐의 쉼 (예시)',
        artist: '예시 아티스트',
        cover_url: null,
        spotify_search_url: '',
      },
      recommendation: '시험 전날 잠깐 쉬면서 듣던 곡이야.',
    },
  },
  {
    id: 'example-mongchi',
    kind: 'text',
    tone: 'empathy',
    category_id: null,
    author_type: 'mongchi',
    author_label: '뭉치',
    available: true,
    viewer,
    content: { text: '여기까지 세느라 수고했어.\n나머지는 내가 천천히 셀게.' },
  },
  {
    id: 'example-warm',
    kind: 'text',
    tone: 'warm',
    category_id: null,
    author_type: 'seed',
    author_label: '먼저 지나간 양',
    available: true,
    viewer,
    content: { text: '오늘 하루도 버틴 너, 이제 눈 감아도 괜찮아.' },
  },
];
/** UI samples only, not the server's feed composition or pause-placement algorithm. */
export function createMockNightFeed(
  count: number,
  scenario: FeedScenario = 'success',
): FeedLoad {
  if (!Number.isInteger(count) || count < 3 || count > 30)
    throw new Error('Preview count must be an integer from 3 to 30.');
  let failed = false;
  return (signal) =>
    new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new ApiError('aborted'));
        return;
      }
      const cleanup = () => {
        clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
      };
      const onAbort = () => {
        cleanup();
        reject(new ApiError('aborted'));
      };
      const timer = setTimeout(() => {
        cleanup();
        if (scenario === 'retry' && !failed) {
          failed = true;
          reject(new ApiError('network'));
          return;
        }
        if (scenario === 'empty') {
          resolve([]);
          return;
        }
        const cards = Array.from({ length: count }, (_, index): Card => {
          const sample = sampleCards[index === count - 1 ? 5 : index % 6];
          const card = {
            ...sample,
            id: `preview-card-${index + 1}`,
            viewer: { ...sample.viewer },
          };
          if (scenario === 'unavailable' && index === 0)
            return { ...card, available: false, content: null };
          if (scenario === 'long' && index === 0)
            return {
              ...card,
              kind: 'text',
              content: {
                text: '오늘 하루를 천천히 돌아보면서 잠깐 쉬어 가도 괜찮아. '.repeat(
                  12,
                ),
              },
            };
          return card;
        });
        resolve(cards);
      }, 800);
      signal.addEventListener('abort', onAbort, { once: true });
    });
}

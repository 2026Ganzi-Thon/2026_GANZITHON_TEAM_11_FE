import type { SavedSong, SongActions } from '../features/songs/types';
import { ApiError } from '../api/errors';
export type SongScenario =
  | 'success'
  | 'empty'
  | 'load-retry'
  | 'remove-retry'
  | 'long'
  | 'external-fail';
export function createMockSavedSongs(
  scenario: SongScenario = 'success',
): SongActions {
  let items: SavedSong[] =
    scenario === 'empty'
      ? []
      : [
          {
            card_id: 'song-example',
            saved_at: '2026-11-12T16:12:00Z',
            track: {
              id: 'track-example',
              title:
                scenario === 'long'
                  ? '잠 못 드는 긴 밤에 천천히 쉬어 가도 괜찮다는 노래 '.repeat(
                      4,
                    )
                  : '밤편지',
              artist:
                scenario === 'long'
                  ? '이름이 아주 긴 예시 아티스트와 함께 부르는 친구들'
                  : '아이유',
              cover_url: null,
              spotify_search_url: '',
            },
          },
        ];
  const failed = new Set<string>();
  function request<T>(
    signal: AbortSignal,
    key: string,
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
      const timer = setTimeout(() => {
        cleanup();
        try {
          if (scenario === `${key}-retry` && !failed.has(key)) {
            failed.add(key);
            throw new ApiError('network');
          }
          resolve(job());
        } catch (error) {
          reject(error);
        }
      }, 400);
      signal.addEventListener('abort', abort, { once: true });
    });
  }
  return {
    load: (signal) => request(signal, 'load', () => items),
    set: (id, saved, signal) =>
      request(signal, 'remove', () => {
        if (saved)
          throw new ApiError('http', { status: 409, code: 'NIGHT_CLOSED' });
        items = items.filter((item) => item.card_id !== id);
        return false;
      }),
  };
}

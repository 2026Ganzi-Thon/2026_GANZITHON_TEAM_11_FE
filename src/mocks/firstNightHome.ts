import { ApiError } from '../api/errors';
import { fortuneDate, homePhase } from '../features/home/model';
import type { HomeSource } from '../features/home/types';
import type { Registration } from '../features/signup/types';
import type { SettingsMorningOptions } from './settingsMorning';
import { createSettingsMorning } from './settingsMorning';
import { createMockMorning } from './morning';
import { createMockMyCards } from './myCards';
import { createMockReceivedYarn } from './receivedYarn';
export type HomeScenario =
  | 'day'
  | 'night'
  | 'before-night'
  | 'before-day'
  | 'load-retry'
  | 'refresh-retry'
  | 'slow'
  | 'fortune-retry'
  | 'adopted'
  | 'empty-flock'
  | 'candidates'
  | 'banner';
function delayed<T>(signal: AbortSignal, read: () => T, ms = 300): Promise<T> {
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
        resolve(read());
      } catch (error) {
        reject(error);
      }
    }, ms);
    signal.addEventListener('abort', abort, { once: true });
  });
}
/** Server-time fixtures advance monotonically within one memory-only preview. */
export function createMockHome(
  scenario: HomeScenario = 'day',
  options: SettingsMorningOptions & {
    identity?: Registration;
    now?: () => number;
  } = {},
): HomeSource {
  const previous = ['adopted', 'empty-flock', 'candidates', 'banner'].includes(
    scenario,
  );
  const count = previous ? 7 : 0;
  const base = Date.parse(
    scenario === 'before-night'
      ? '2026-11-15T20:59:52+09:00'
      : scenario === 'before-day'
        ? '2026-11-16T03:59:52+09:00'
        : scenario === 'day' || scenario === 'load-retry' || previous
          ? '2026-11-15T12:00:00+09:00'
          : '2026-11-15T21:00:00+09:00',
  );
  const started = performance.now(),
    now = options.now ?? (() => base + performance.now() - started);
  const combined = createSettingsMorning(
    previous ? 'success' : 'empty',
    options,
  );
  const settings = {
    ...combined.settings,
    loadMe: async (signal: AbortSignal) => {
      const value = await combined.settings.loadMe(signal);
      return {
        ...value,
        user: {
          ...value.user,
          id: options.identity?.id ?? 'preview-home-user',
          email: options.identity?.email ?? value.user.email,
          stats: { ...value.user.stats, night_count: count },
        },
      };
    },
  };
  let loads = 0,
    fortuneFailed = false;
  const fortune = {
    load: async (signal: AbortSignal) => {
      const value = await combined.fortune.load(signal);
      if (scenario === 'fortune-retry' && !fortuneFailed) {
        fortuneFailed = true;
        throw new ApiError('network');
      }
      return { ...value, date: fortuneDate(now()) };
    },
  };
  const morning = {
    ...(scenario === 'candidates' ? createMockMorning() : combined),
    settings,
    fortune,
    receivedYarn: createMockReceivedYarn(
      scenario === 'banner' ? 'success' : 'none',
    ),
  };
  if (scenario === 'empty-flock') {
    morning.loadMorning = async (signal) =>
      delayed(signal, () => ({
        night: null,
        counted_sheep: null,
        candidate_cards: [],
        default_card_id: null,
        adoption: null,
      }));
    morning.loadFlock = async (signal) => delayed(signal, () => []);
  }
  return {
    settings,
    fortune,
    morning,
    loadDetail: combined.loadSheep,
    cards: createMockMyCards(previous ? 'success' : 'empty'),
    clock: {
      load: (signal) => {
        const call = ++loads;
        return delayed(
          signal,
          () => {
            if (
              (scenario === 'load-retry' && call === 1) ||
              (scenario === 'refresh-retry' && call === 2)
            )
              throw new ApiError('network');
            const time = now();
            return {
              server_time: new Date(time).toISOString(),
              timezone: 'Asia/Seoul',
              phase: homePhase(time),
              user: {
                id: options.identity?.id ?? 'preview-home-user',
                stats: { night_count: count },
              },
            };
          },
          scenario === 'slow' ? 6000 : 300,
        );
      },
    },
  };
}

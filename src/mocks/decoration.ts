import { ApiError } from '../api/errors';
import { homePhase } from '../features/home/model';
import type { Sheep } from '../features/morning/types';
import type { SheepDetailLoad } from '../features/flock/types';
import { validPlacements } from '../features/decoration/model';
import type {
  DecoratedSheep,
  DecorationActions,
  Sticker,
} from '../features/decoration/types';
export type DecorationScenario =
  | 'success'
  | 'load-retry'
  | 'save-retry'
  | 'save-lost'
  | 'slow'
  | 'conflict'
  | 'verify-retry'
  | 'night';
export const mockStickers: Sticker[] = [
  { id: 'st-1', label: '별', asset_key: 'star' },
  { id: 'st-2', label: '동그라미', asset_key: 'circle' },
  { id: 'st-3', label: '세모', asset_key: 'triangle' },
  { id: 'st-4', label: '반짝별', asset_key: 'sparkle' },
  { id: 'st-5', label: '마름모', asset_key: 'diamond' },
  { id: 'st-6', label: '동그라미 2', asset_key: 'circle' },
  { id: 'st-7', label: '세모 2', asset_key: 'triangle' },
];
const clone = (s: DecoratedSheep): DecoratedSheep => ({
  ...s,
  placements: s.placements.map((p) => ({ ...p })),
});
/** One source-owned memory overlay. Does not persist or call the server. */
export function createMockDecoration(
  loadSheep: SheepDetailLoad,
  options: { now?: () => number; scenario?: DecorationScenario } = {},
): DecorationActions & { decorate(sheep: Sheep): Sheep } {
  const saved = new Map<string, DecoratedSheep>(),
    failed = new Set<string>();
  const scenario = options.scenario ?? 'success';
  const now = options.now ?? (() => Date.parse('2026-11-17T12:00:00+09:00'));
  const failOnce = (key: string) => {
    if (!failed.has(key)) {
      failed.add(key);
      throw new ApiError('network');
    }
  };
  const wait = <T>(
    signal: AbortSignal,
    job: () => Promise<T> | T,
    slow = false,
  ) =>
    new Promise<T>((resolve, reject) => {
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
        async () => {
          cleanup();
          try {
            const result = await job();
            if (signal.aborted) throw new ApiError('aborted');
            resolve(result);
          } catch (e) {
            reject(e);
          }
        },
        slow ? 5000 : 350,
      );
      signal.addEventListener('abort', abort, { once: true });
    });
  const read = async (id: string, signal: AbortSignal) => {
    const detail = await loadSheep(id, signal);
    if (signal.aborted) throw new ApiError('aborted');
    return saved.get(id) ?? { ...detail.sheep, version: 1, placements: [] };
  };
  return {
    decorate: (sheep) =>
      saved.has(sheep.id) ? clone(saved.get(sheep.id)!) : sheep,
    load: (id, signal) =>
      wait(signal, async () => {
        if (scenario === 'load-retry') failOnce('load');
        if (scenario === 'verify-retry' && failed.has('save'))
          failOnce('verify');
        return {
          sheep: clone(await read(id, signal)),
          stickers: mockStickers.map((st) => ({ ...st })),
        };
      }),
    save: (id, input, signal) =>
      wait(
        signal,
        async () => {
          const current = await read(id, signal);
          if (signal.aborted) throw new ApiError('aborted');
          if (scenario === 'night' || homePhase(now()) !== 'day')
            throw new ApiError('http', { status: 409, code: 'DAY_ONLY' });
          if (
            !Number.isSafeInteger(input.if_version) ||
            !validPlacements(
              input.placements,
              new Set(mockStickers.map((st) => st.id)),
            )
          )
            throw new ApiError('http', {
              status: 422,
              code: 'VALIDATION_ERROR',
            });
          if (scenario === 'conflict' && !failed.has('conflict')) {
            failed.add('conflict');
            saved.set(id, {
              ...current,
              version: current.version + 1,
              placements: [
                {
                  instance_id: 'external',
                  sticker_id: 'st-4',
                  x: 0.2,
                  y: 0.3,
                  rotation: 0,
                  scale: 1,
                },
              ],
            });
          }
          const latest = saved.get(id) ?? current;
          if (latest.version !== input.if_version)
            throw new ApiError('http', {
              status: 409,
              code: 'VERSION_CONFLICT',
            });
          if (scenario === 'save-retry' || scenario === 'verify-retry')
            failOnce('save');
          const result = {
            ...current,
            version: current.version + 1,
            placements: input.placements.map((p) => ({ ...p })),
          };
          saved.set(id, result);
          if (scenario === 'save-lost') failOnce('save');
          return clone(result);
        },
        scenario === 'slow',
      ),
  };
}

import { ApiError } from '../api/errors';
import { stopOfferPosition } from '../features/night/stopOffer/model';
import { createMockMultiNightJourney } from './multiNightJourney';
export type StopOfferJourneyPreset =
  | 'success'
  | 'none'
  | 'lost'
  | 'slow'
  | 'retry'
  | 'expiry'
  | 'expiry-save'
  | 'expiry-retry';
/** One account, starting at the stop offer; time controls are preview-only. */
export async function createStopOfferJourney(
  preset: StopOfferJourneyPreset,
  signal: AbortSignal,
  count = 20,
) {
  const position = stopOfferPosition(count);
  if (position === null) throw new ApiError('configuration');
  let base = Date.parse('2026-11-16T21:30:00+09:00'),
    started = performance.now();
  const now = () => base + performance.now() - started;
  const source = createMockMultiNightJourney({
    identity: { id: 'stop-offer-preview', email: 'stop-offer@example.com' },
    nightScenario:
      preset === 'slow' || preset === 'expiry-save'
        ? 'stop-slow-finish'
        : preset === 'retry' || preset === 'expiry-retry'
          ? 'stop-retry-finish'
          : preset === 'lost'
            ? 'stop-lost-finish'
            : 'success',
    clock: {
      now,
      advanceMorning: (date) => {
        base = Math.max(now(), Date.parse(`${date}T04:00:00+09:00`) + 86400000);
        started = performance.now();
      },
    },
  });
  await source.night.entry.checkWorry(
    {
      category_id: preset === 'none' ? 'none' : 'career',
      worry_text:
        preset === 'none'
          ? null
          : '오늘 할 일이 많았어요. 남은 걱정은 잠깐 쉬었다 생각할래요.',
    },
    signal,
  );
  await source.night.entry.startCounting(count, signal);
  await source.night.loadFeed(signal);
  if (signal.aborted) throw new ApiError('aborted');
  source.night.progress({ position, furthestPosition: position });
  source.navigation.setPage('feed');
  if (preset.startsWith('expiry')) {
    base = Date.parse('2026-11-17T04:00:00+09:00') - 20000;
    started = performance.now();
  }
  return source;
}

import { ApiError } from '../api/errors';
import { createMockMultiNightJourney } from './multiNightJourney';
export type EntrustPreview =
  | 'success'
  | 'slow'
  | 'retry'
  | 'lost'
  | 'long'
  | 'none'
  | 'expiry'
  | 'expiry-save'
  | 'expiry-retry';
export async function createEntrustPreview(
  preset: EntrustPreview,
  signal: AbortSignal,
) {
  let base = Date.parse('2026-11-16T21:30:00+09:00'),
    started = performance.now();
  const now = () => base + performance.now() - started;
  const journey = createMockMultiNightJourney({
    identity: { id: 'entrust-preview', email: 'entrust@example.com' },
    nightScenario:
      preset === 'slow' || preset === 'expiry-save'
        ? 'entrust-slow'
        : preset === 'retry'
          ? 'entrust-retry'
          : preset === 'expiry-retry'
            ? 'entrust-slow-retry'
            : preset === 'lost'
              ? 'entrust-lost-response'
              : 'success',
    clock: {
      now,
      advanceMorning: (date) => {
        base = Math.max(now(), Date.parse(`${date}T04:00:00+09:00`) + 86400000);
        started = performance.now();
      },
    },
  });
  const demo = journey.night;
  const worry =
    preset === 'none'
      ? null
      : preset === 'long'
        ? '해야 할 일이 자꾸 떠올라요. 오늘은 걱정을 잠시 내려놓고 쉬고 싶어요. '.repeat(
            4,
          )
        : '내일 회의가 걱정돼요. 오늘 밤은 잠깐 쉬고 싶어요.';
  await demo.entry.checkWorry(
    { category_id: worry === null ? 'none' : 'career', worry_text: worry },
    signal,
  );
  await demo.entry.startCounting(7, signal);
  await demo.loadFeed(signal);
  if (signal.aborted) throw new ApiError('aborted');
  demo.progress({ position: 4, furthestPosition: 4 });
  const navigation = journey.navigation;
  navigation.setPage('feed');
  if (preset.startsWith('expiry')) {
    base = Date.parse('2026-11-17T04:00:00+09:00') - 20000;
    started = performance.now();
  }
  return { demo, navigation, journey };
}

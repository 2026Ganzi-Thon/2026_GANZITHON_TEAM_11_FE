import { ApiError } from '../api/errors';
import { createMockMultiNightJourney } from './multiNightJourney';
export type ReturnJourneyScenario =
  'completed' | 'stopped' | 'closing' | 'lost' | 'expiry';
/** Seed one confirmed night in the same account; the following session is created by N02. */
export async function createMockNightReturnJourney(
  scenario: ReturnJourneyScenario,
  signal: AbortSignal,
) {
  let base = Date.parse('2026-11-16T23:30:00+09:00'),
    started = performance.now();
  const now = () => base + performance.now() - started;
  const source = createMockMultiNightJourney({
    identity: { id: 'return-account', email: 'return@example.com' },
    nightScenario: scenario === 'lost' ? 'return-create-lost' : 'success',
    clock: {
      now,
      advanceMorning: (date) => {
        base = Math.max(now(), Date.parse(`${date}T04:00:00+09:00`) + 86400000);
        started = performance.now();
      },
    },
  });
  const d = source.night;
  await d.entry.checkWorry(
    {
      category_id: 'career',
      worry_text: '내일 면접이 걱정돼요. 오늘은 천천히 쉬어 가고 싶어요.',
    },
    signal,
  );
  await d.entry.startCounting(3, signal);
  const cards = await d.loadFeed(signal);
  const count = scenario === 'stopped' ? 2 : 3;
  d.progress({ position: count, furthestPosition: count });
  await d.yarn.set(cards[0].id, true, signal);
  await d.fluff.set(cards[0].id, true, signal);
  const request = {
    reason:
      scenario === 'stopped' ? ('leave' as const) : ('completed' as const),
    position: count,
    furthestPosition: count,
    sheepCount: 3,
  };
  const result = await d.closing.finish(request, 'return-seed', signal);
  if (scenario !== 'closing') {
    if (result.closing_card)
      await d.closing.markViewed(result.closing_card.id, 'return-view', signal);
    await d.closing.chooseWriting('morning', 'return-defer', signal);
    d.confirmClosing();
    source.navigation.setPage('rest');
  } else source.navigation.closing(request);
  if (signal.aborted) throw new ApiError('aborted');
  if (scenario === 'expiry') {
    base = Date.parse('2026-11-17T04:00:00+09:00') - 20000;
    started = performance.now();
  }
  return source;
}

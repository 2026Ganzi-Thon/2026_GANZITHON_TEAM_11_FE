import { ApiError } from '../api/errors';
import { createMockMultiNightJourney } from './multiNightJourney';
export type ExpiryPreviewScenario =
  'partial' | 'unseen' | 'check-retry' | 'morning-retry' | 'writing';
/** Explicit preview seed. Its deadline starts after preparation has finished. */
export async function createNightExpiryPreview(
  scenario: ExpiryPreviewScenario,
  signal: AbortSignal,
) {
  let base = Date.parse('2026-11-16T21:30:00+09:00'),
    started = performance.now();
  const now = () => base + performance.now() - started;
  const source = createMockMultiNightJourney({
    identity: { id: 'expiry-preview', email: 'expiry@example.com' },
    expiryScenario:
      scenario === 'check-retry' || scenario === 'morning-retry'
        ? scenario
        : 'success',
    clock: {
      now,
      advanceMorning: (date) => {
        base = Math.max(now(), Date.parse(`${date}T04:00:00+09:00`) + 86400000);
        started = performance.now();
      },
    },
  });
  const d = source.night,
    count = scenario === 'writing' ? 3 : 5;
  await d.entry.checkWorry(
    {
      category_id: 'career',
      worry_text: '내일 회의가 걱정돼요. 오늘은 여기까지 쉬어 가고 싶어요.',
    },
    signal,
  );
  await d.entry.startCounting(count, signal);
  if (scenario === 'unseen') source.navigation.pause('feed');
  else {
    await d.loadFeed(signal);
    d.progress({
      position: scenario === 'writing' ? 3 : 2,
      furthestPosition: scenario === 'writing' ? 3 : 2,
    });
    if (scenario === 'writing') {
      const request = {
        reason: 'completed' as const,
        position: 3,
        furthestPosition: 3,
        sheepCount: 3,
      };
      await d.closing.finish(request, 'expiry-preview-finish', signal);
      d.cardWriting.choose({ category_id: 'career', kind: 'text' });
      d.cardWriting.text.writeDraft({
        category_id: 'career',
        text: '마감 전에 적어 둔 초안이에요.',
      });
      source.navigation.closing(request);
    } else source.navigation.setPage('feed');
  }
  if (signal.aborted) throw new ApiError('aborted');
  base = Date.parse('2026-11-17T04:00:00+09:00') - 30000;
  started = performance.now();
  return source;
}

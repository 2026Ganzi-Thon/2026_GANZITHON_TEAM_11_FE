import { ApiError } from '../api/errors';
import type { createMockSignupJourney } from './signupJourney';
/** Explicit connected fixture setup; it never represents another real user's reaction. */
export async function prepareReceivedYarnMorning(
  source: ReturnType<typeof createMockSignupJourney>,
  signal: AbortSignal,
  amount: 0 | 1 | 3 = 3,
) {
  if (signal.aborted) throw new ApiError('aborted');
  const c = source.onboarding;
  c.start();
  if (c.getSnapshot().stage === 'signup') {
    c.begin(
      { id: 'received-yarn-preview', email: 'preview@example.com' },
      { birth_date: '2004-05-14', edits_remaining: 1, zodiac: 'taurus' },
    );
    c.skip();
  }
  source.advanceNight();
  const journey = source.getJourney();
  if (!journey || journey.enterNight() === false)
    throw new ApiError('configuration');
  if (amount) journey.previewReceiveYarn(amount);
  const night = journey.night;
  await night.entry.checkWorry(
    {
      category_id: 'career',
      worry_text: '오늘은 마음을 조금 쉬게 하고 싶어요.',
    },
    signal,
  );
  await night.entry.startCounting(3, signal);
  await night.loadFeed(signal);
  night.progress({ position: 3, furthestPosition: 3 });
  await night.closing.finish(
    { reason: 'completed', position: 3, furthestPosition: 3, sheepCount: 3 },
    `received-home:${night.nightId}`,
    signal,
  );
  journey.advanceMorning();
  const morning = await night.morning.loadMorning(signal);
  await night.morning.adopt(night.nightId, morning.default_card_id!, signal);
  if (c.getSnapshot().stage === 'intro') c.acknowledge();
}

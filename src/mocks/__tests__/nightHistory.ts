import { jest } from '@jest/globals';
import type { createNightMorningDemo } from '../nightMorningDemo';
export const signal = () => new AbortController().signal;
export async function settle<T>(p: Promise<T>): Promise<T> {
  return (await Promise.all([p, jest.runAllTimersAsync()]))[0];
}
type Demo = ReturnType<typeof createNightMorningDemo>;
export async function start(
  demo: Demo,
  count = 3,
  text: string | null = '첫째 밤의 고민',
) {
  await settle(
    demo.entry.checkWorry(
      { category_id: text === null ? 'none' : 'career', worry_text: text },
      signal(),
    ),
  );
  await settle(demo.entry.startCounting(count, signal()));
  return settle(demo.loadFeed(signal()));
}
export function finish(demo: Demo, count = 3) {
  return settle(
    demo.closing.finish(
      {
        reason: 'completed',
        position: count,
        furthestPosition: count,
        sheepCount: count,
      },
      'finish-once',
      signal(),
    ),
  );
}
export async function complete(
  demo: Demo,
  count = 3,
  text: string | null = '첫째 밤의 고민',
) {
  await start(demo, count, text);
  demo.progress({ position: count, furthestPosition: count });
  await finish(demo, count);
  demo.advanceMorning();
  const morning = await settle(demo.morning.loadMorning(signal()));
  return settle(
    demo.morning.adopt(demo.nightId, morning.default_card_id!, signal()),
  );
}

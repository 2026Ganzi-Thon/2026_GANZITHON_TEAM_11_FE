import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { createMockHome } from './firstNightHome';
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
const signal = () => new AbortController().signal;
async function settle<T>(promise: Promise<T>, delay = 600) {
  await jest.advanceTimersByTimeAsync(delay);
  return promise;
}
it('advances the mock server clock across 21 and 04 without following the device wall clock', async () => {
  for (const [scenario, before, after] of [
    ['before-night', 'day', 'night'],
    ['before-day', 'night', 'day'],
  ] as const) {
    const home = createMockHome(scenario);
    expect((await settle(home.clock.load(signal()))).phase).toBe(before);
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2040-01-01T00:00:00Z'));
    await jest.advanceTimersByTimeAsync(9000);
    expect((await settle(home.clock.load(signal()))).phase).toBe(after);
  }
});
it('keeps first-night profile, statistics and fortune date consistent and refreshes the fortune at 04', async () => {
  const home = createMockHome('before-day');
  expect(
    (await settle(home.settings!.loadMe(signal()))).user.stats.night_count,
  ).toBe(0);
  expect((await settle(home.fortune.load(signal()))).date).toBe('2026-11-15');
  await jest.advanceTimersByTimeAsync(9000);
  expect((await settle(home.fortune.load(signal()))).date).toBe('2026-11-16');
});
it('cancels delayed clock work and leaves failures explicit until the next load', async () => {
  const home = createMockHome('load-retry'),
    controller = new AbortController();
  const failed = expect(home.clock.load(signal())).rejects.toMatchObject({
    kind: 'network',
  });
  await jest.advanceTimersByTimeAsync(600);
  await failed;
  expect((await settle(home.clock.load(signal()))).user.stats.night_count).toBe(
    0,
  );
  const aborted = expect(
    home.clock.load(controller.signal),
  ).rejects.toMatchObject({ kind: 'aborted' });
  controller.abort();
  await aborted;
});

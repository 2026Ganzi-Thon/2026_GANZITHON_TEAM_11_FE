import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { prepareReceivedYarnMorning } from './receivedYarnHomePreview';
import { createMockSignupJourney } from './signupJourney';
import { createMockReminder } from './reminder';
import { createReminderConnection } from '../notifications/connection';
import { createDeviceReminder } from '../notifications/service';
import { storedDevice } from '../notifications/__tests__/storedDevice';
import { settle, signal } from './__tests__/nightHistory';
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});
function source() {
  const account = createMockReminder();
  return createMockSignupJourney(
    {
      ...account,
      ...createReminderConnection(
        account,
        createDeviceReminder(storedDevice().port),
      ),
    },
    'night',
  );
}
it('prepares dated received examples on one registered account without resetting its history or seen state', async () => {
  const s = source();
  await settle(prepareReceivedYarnMorning(s, signal(), 3));
  const first = s.getJourney()!;
  const one = first.home.resolveMorning!(
    await settle(first.home.clock.load(signal())),
  ).receivedYarn!;
  expect((await settle(one.load(signal())))?.yarn_count).toBe(3);
  await settle(one.markSeen('received-yarn-preview:2026-11-17', signal()));
  await settle(prepareReceivedYarnMorning(s, signal(), 1));
  expect(s.getJourney()).toBe(first);
  expect(first.history.getStats().night_count).toBe(2);
  const two = first.home.resolveMorning!(
    await settle(first.home.clock.load(signal())),
  ).receivedYarn!;
  expect(await settle(two.load(signal()))).toMatchObject({
    date: '2026-11-18',
    yarn_count: 1,
  });
});
it('does not seed incoming cards for an empty scenario and stops a cancelled preparation', async () => {
  const s = source();
  await settle(prepareReceivedYarnMorning(s, signal(), 0));
  const j = s.getJourney()!;
  const p = j.home.resolveMorning!(
    await settle(j.home.clock.load(signal())),
  ).receivedYarn!;
  expect(await settle(p.loadLatest!(signal()))).toBeNull();
  expect((await settle(j.home.cards!.load({}, signal()))).items).toEqual([]);
  const controller = new AbortController();
  controller.abort();
  await expect(
    prepareReceivedYarnMorning(s, controller.signal, 3),
  ).rejects.toMatchObject({ kind: 'aborted' });
  expect(j.history.getStats().night_count).toBe(1);
});

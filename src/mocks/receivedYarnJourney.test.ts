import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { createMockMultiNightJourney } from './multiNightJourney';
import { createMockSignupJourney } from './signupJourney';
import { createMockReminder } from './reminder';
import { createReminderConnection } from '../notifications/connection';
import { createDeviceReminder } from '../notifications/service';
import { storedDevice } from '../notifications/__tests__/storedDevice';
import { complete, signal, settle } from './__tests__/nightHistory';
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});
function fixture() {
  let time = Date.parse('2026-11-16T21:30:00+09:00');
  const source = createMockMultiNightJourney({
    identity: { id: 'owner', email: 'owner@example.com' },
    clock: {
      now: () => time,
      advanceMorning: (date) => {
        time = Date.parse(`${date}T04:00:00+09:00`) + 86400000;
      },
    },
  });
  return {
    source,
    time: (value: string) => {
      time = Date.parse(value);
    },
  };
}
it('connects a received summary and owned card counts to the same dated account, with independent seen state each day', async () => {
  const f = fixture(),
    s = f.source;
  s.previewReceiveYarn(3);
  await complete(s.night);
  s.advanceMorning();
  let actions = s.home.resolveMorning!(
    await settle(s.home.clock.load(signal())),
  );
  let port = actions.receivedYarn!;
  expect(await settle(port.load(signal()))).toMatchObject({
    id: 'owner:2026-11-17',
    yarn_count: 3,
    sender_count: 2,
  });
  await settle(port.markSeen('owner:2026-11-17', signal()));
  expect(await settle(port.load(signal()))).toBeNull();
  expect((await settle(port.loadLatest!(signal())))?.yarn_count).toBe(3);
  expect(
    (await settle(s.home.cards!.load({}, signal()))).items
      .map((c) => c.yarn_count)
      .sort(),
  ).toEqual([1, 2]);
  f.time('2026-11-17T21:30:00+09:00');
  s.enterNight();
  s.previewReceiveYarn(1);
  await complete(s.night);
  s.advanceMorning();
  actions = s.home.resolveMorning!(await settle(s.home.clock.load(signal())));
  port = actions.receivedYarn!;
  expect(await settle(port.load(signal()))).toMatchObject({
    id: 'owner:2026-11-18',
    yarn_count: 1,
    sender_count: 1,
  });
  expect(
    (await settle(s.home.cards!.load({}, signal()))).items
      .map((c) => c.yarn_count)
      .sort(),
  ).toEqual([1, 3]);
});
it('keeps nighttime automatic reads off while the bell can reopen the current summary', async () => {
  const f = fixture(),
    s = f.source;
  s.previewReceiveYarn(3);
  await complete(s.night);
  s.advanceMorning();
  f.time('2026-11-17T21:00:00+09:00');
  const port = s.home.resolveMorning!(
    await settle(s.home.clock.load(signal())),
  ).receivedYarn!;
  expect(await settle(port.load(signal()))).toBeNull();
  expect((await settle(port.loadLatest!(signal())))?.yarn_count).toBe(3);
});
it('revokes a withdrawn accounts inbox and creates an empty inbox on its next signup', async () => {
  const device = storedDevice(),
    account = createMockReminder();
  const reminder = {
    ...account,
    ...createReminderConnection(account, createDeviceReminder(device.port)),
  };
  const source = createMockSignupJourney(reminder, 'night');
  source.onboarding.begin(
    { id: 'old', email: 'old@example.com' },
    { birth_date: '2000-01-01', edits_remaining: 1, zodiac: 'capricorn' },
  );
  source.onboarding.skip();
  await jest.runAllTimersAsync();
  const old = source.getJourney()!;
  old.previewReceiveYarn(3);
  await complete(old.night);
  old.advanceMorning();
  const port = old.home.resolveMorning!(
    await settle(old.home.clock.load(signal())),
  ).receivedYarn!;
  expect((await settle(port.load(signal())))?.yarn_count).toBe(3);
  await settle(old.home.settings!.withdrawal!.withdraw(signal()));
  await expect(port.loadLatest!(signal())).rejects.toMatchObject({
    code: 'ACCOUNT_WITHDRAWN',
  });
  source.onboarding.begin(
    { id: 'new', email: 'new@example.com' },
    { birth_date: '2000-01-01', edits_remaining: 1, zodiac: 'capricorn' },
  );
  source.onboarding.skip();
  await jest.runAllTimersAsync();
  const next = source.getJourney()!;
  const nextPort = next.home.resolveMorning!(
    await settle(next.home.clock.load(signal())),
  ).receivedYarn!;
  expect(await settle(nextPort.loadLatest!(signal()))).toBeNull();
});

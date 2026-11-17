import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { createMockSignupJourney } from './signupJourney';
import { createMockReminder } from './reminder';
import { createReminderConnection } from '../notifications/connection';
import { createDeviceReminder } from '../notifications/service';
import { storedDevice } from '../notifications/__tests__/storedDevice';
import { complete, settle, signal } from './__tests__/nightHistory';
import { deferred, scheduled } from '../notifications/__tests__/fakeDevice';
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
async function fixture(
  withdrawalScenario: 'success' | 'retry' | 'slow' = 'success',
) {
  const device = storedDevice(),
    account = createMockReminder();
  const connection = createReminderConnection(
    account,
    createDeviceReminder(device.port),
  );
  const source = createMockSignupJourney(
    { ...account, ...connection },
    'night',
    { withdrawalScenario },
  );
  source.onboarding.begin(
    { id: 'old-account', email: 'old@example.com' },
    { birth_date: '2001-03-12', edits_remaining: 1, zodiac: 'pisces' },
  );
  source.onboarding.skip();
  await jest.runAllTimersAsync();
  return { ...device, source, account, connection, old: source.getJourney()! };
}
it('removes the dated account and revokes old profile, history, writing and reaction actions before a fresh signup', async () => {
  const f = await fixture();
  const sheep = await complete(f.old.night, 3, '삭제할 고민');
  f.old.advanceMorning();
  const morning = f.old.home.resolveMorning!(
    await settle(f.old.home.clock.load(signal())),
  );
  await settle(morning.reflection!.save(sheep.night_id, 'smaller', signal()));
  const writing = f.old.home.cards!.createWritingSession().text;
  const draft = writing.writeDraft({
    category_id: 'career',
    text: '삭제할 글',
  });
  await settle(
    writing.submit(
      {
        kind: 'text',
        category_id: 'career',
        content: { text: draft.text },
      },
      draft.operationKey,
      signal(),
    ),
  );
  expect(
    (await settle(f.old.home.cards!.load({}, signal()))).items,
  ).toHaveLength(1);
  expect(await settle(f.old.home.morning.loadFlock(signal()))).toHaveLength(1);
  await settle(
    f.connection.save({ enabled: true, local_time: '23:00' }, signal()),
  );
  f.records.set('foreign-feature', scheduled('foreign-feature', '19:00'));
  f.alarms.set('foreign-feature', scheduled('foreign-feature', '19:00'));
  const oldSignup = f.source.signup;
  const withdrawal = f.old.home.settings!.withdrawal!;
  await settle(withdrawal.withdraw(signal()));
  expect(f.source.getJourney()).toBeNull();
  expect(f.source.onboarding.getSnapshot().stage).toBe('signup');
  expect(f.account.readSnapshot()).toEqual({
    enabled: false,
    local_time: null,
  });
  expect([...f.records.keys()]).toEqual(['foreign-feature']);
  expect([...f.alarms.keys()]).toEqual(['foreign-feature']);
  await expect(f.old.home.settings!.loadMe(signal())).rejects.toMatchObject({
    code: 'ACCOUNT_WITHDRAWN',
  });
  await expect(f.old.home.cards!.load({}, signal())).rejects.toMatchObject({
    code: 'ACCOUNT_WITHDRAWN',
  });
  await expect(morning.loadMorning(signal())).rejects.toMatchObject({
    code: 'ACCOUNT_WITHDRAWN',
  });
  await expect(
    writing.submit(
      {
        kind: 'text',
        category_id: 'career',
        content: { text: 'late' },
      },
      'late',
      signal(),
    ),
  ).rejects.toMatchObject({ code: 'ACCOUNT_WITHDRAWN' });
  expect(() => f.old.night.getRecord()).toThrow();
  await expect(
    f.old.night.yarn.set('preview-card-1', true, signal()),
  ).rejects.toMatchObject({ code: 'ACCOUNT_WITHDRAWN' });
  await expect(
    f.old.night.fluff.set('preview-card-1', true, signal()),
  ).rejects.toMatchObject({ code: 'ACCOUNT_WITHDRAWN' });
  await expect(
    f.old.night.songs.set('preview-card-3', true, signal()),
  ).rejects.toMatchObject({ code: 'ACCOUNT_WITHDRAWN' });
  await expect(
    f.old.home.morning.decoration!.load(sheep.id, signal()),
  ).rejects.toMatchObject({ code: 'ACCOUNT_WITHDRAWN' });

  await expect(
    oldSignup.register(
      'late',
      { email: 'old@example.com', password: 'password' },
      signal(),
    ),
  ).rejects.toMatchObject({ code: 'ACCOUNT_WITHDRAWN' });
  const identity = await settle(
    f.source.signup.register(
      'new',
      { email: 'new@example.com', password: 'password' },
      signal(),
    ),
  );
  expect(identity.id).not.toBe('old-account');
  f.source.onboarding.begin(identity, {
    birth_date: '2000-01-01',
    edits_remaining: 1,
    zodiac: 'capricorn',
  });
  f.source.onboarding.skip();
  await jest.runAllTimersAsync();
  const next = f.source.getJourney()!;
  expect(next.history.getStats()).toEqual({
    night_count: 0,
    counted_sheep_total: 0,
    worry_record_count: 0,
  });
  expect(await settle(next.home.morning.loadFlock(signal()))).toEqual([]);
  expect((await settle(next.home.cards!.load({}, signal()))).items).toEqual([]);
  expect(
    (await settle(next.home.settings!.loadMe(signal()))).user,
  ).toMatchObject({ email: 'new@example.com', birth_date: '2000-01-01' });
  await expect(withdrawal.withdraw(signal())).rejects.toMatchObject({
    code: 'ACCOUNT_WITHDRAWN',
  });
  expect(f.source.getJourney()).toBe(next);
});
it('preserves the account when device cancellation fails and only completes after a verified retry', async () => {
  const f = await fixture();
  await settle(
    f.connection.save({ enabled: true, local_time: '23:00' }, signal()),
  );
  f.port.cancel.mockRejectedValueOnce(new Error('device failure'));
  await expect(
    settle(f.old.home.settings!.withdrawal!.withdraw(signal())),
  ).rejects.toThrow();
  expect(f.source.getJourney()).toBe(f.old);
  expect(f.source.onboarding.getSnapshot().stage).toBe('home');
  expect(f.alarms.size).toBe(1);
  await settle(f.old.home.settings!.withdrawal!.withdraw(signal()));
  expect(f.source.getJourney()).toBeNull();
  expect(f.alarms.size).toBe(0);
});
it('keeps a retryable mock failure from resetting the account or deleting its records', async () => {
  const f = await fixture('retry');
  await complete(f.old.night, 3, '남아야 할 고민');
  await expect(
    settle(f.old.home.settings!.withdrawal!.withdraw(signal())),
  ).rejects.toThrow();
  expect(f.old.history.getStats().worry_record_count).toBe(1);
  await settle(f.old.home.settings!.withdrawal!.withdraw(signal()));
  expect(f.source.getJourney()).toBeNull();
});
it('aborts pending account reads on successful withdrawal and rejects their late result', async () => {
  const f = await fixture();
  const late = deferred<Awaited<ReturnType<typeof f.old.home.clock.load>>>();
  // Hold the upstream call itself while preserving the account boundary.
  f.old.home.clock.load = () => late.promise;
  const oldLoad = f.old.home.clock.load;
  const pending = oldLoad(signal());
  const result = expect(pending).rejects.toMatchObject({ kind: 'aborted' });
  await settle(f.old.home.settings!.withdrawal!.withdraw(signal()));
  await result;
  await expect(oldLoad(signal())).rejects.toMatchObject({
    code: 'ACCOUNT_WITHDRAWN',
  });
  late.reject(new Error('late upstream failure'));
  await Promise.resolve();
});
it('cancels a slow withdrawal before any account or reminder changes', async () => {
  const f = await fixture('slow');
  const controller = new AbortController();
  const request = f.old.home.settings!.withdrawal!.withdraw(controller.signal);
  controller.abort();
  await expect(request).rejects.toMatchObject({ kind: 'aborted' });
  expect(f.source.getJourney()).toBe(f.old);
  expect(f.source.getVersion()).toBe(0);
});

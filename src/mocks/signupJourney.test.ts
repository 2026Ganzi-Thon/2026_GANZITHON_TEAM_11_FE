import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { createMockSignupJourney } from './signupJourney';
import { createMockReminder } from './reminder';
import { createReminderConnection } from '../notifications/connection';
import { createDeviceReminder } from '../notifications/service';
import { storedDevice } from '../notifications/__tests__/storedDevice';
const signal = () => new AbortController().signal;
async function settle<T>(p: Promise<T>) {
  await jest.runAllTimersAsync();
  return p;
}
function fixture(phase: 'day' | 'night' = 'day') {
  const native = storedDevice(),
    account = createMockReminder();
  const connection = createReminderConnection(
    account,
    createDeviceReminder(native.port),
  );
  const source = createMockSignupJourney({ ...account, ...connection }, phase);
  return { ...native, account, connection, source };
}
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});
it('binds the actual registration, birthday, reminder and next-day clock to one journey', async () => {
  const f = fixture();
  const identity = await settle(
    f.source.signup.register(
      'account-operation',
      { email: 'joined@example.com', password: 'password' },
      signal(),
    ),
  );
  const documents = await settle(f.source.signup.loadDocuments(signal()));
  await settle(
    f.source.signup.consent(
      identity.id,
      {
        revision: documents.revision,
        choices: {
          terms: true,
          privacy: true,
          processing: true,
          notifications: false,
        },
      },
      signal(),
    ),
  );
  const birth = await settle(
    f.source.signup.birth(identity.id, '2001-03-12', signal()),
  );
  f.source.onboarding.begin(identity, birth);
  const journey = f.source.getJourney()!;
  expect(f.source.onboarding.getSnapshot().home).toBe(journey.home);
  expect(
    (await settle(journey.home.settings!.loadMe(signal()))).user,
  ).toMatchObject({
    id: identity.id,
    email: 'joined@example.com',
    birth_date: '2001-03-12',
    birth_date_edits_remaining: 1,
    stats: { night_count: 0 },
  });
  f.source.onboarding.allow();
  await jest.runAllTimersAsync();
  expect(f.source.onboarding.getSnapshot().stage).toBe('intro');
  expect(f.alarms.size).toBe(1);
  expect(
    (await settle(journey.home.settings!.loadMe(signal()))).reminder,
  ).toEqual({ enabled: true, local_time: '23:00' });
  f.source.onboarding.acknowledge();
  expect((await settle(journey.home.clock.load(signal()))).phase).toBe('day');
  f.source.advanceNight();
  expect((await settle(journey.home.clock.load(signal()))).phase).toBe('night');
  await settle(
    journey.night.entry.checkWorry(
      { category_id: 'career', worry_text: '면접이 걱정돼요' },
      signal(),
    ),
  );
  await settle(journey.night.entry.startCounting(3, signal()));
  await settle(journey.night.loadFeed(signal()));
  journey.night.progress({ position: 3, furthestPosition: 3 });
  await settle(
    journey.night.closing.finish(
      { reason: 'completed', position: 3, furthestPosition: 3, sheepCount: 3 },
      'finished',
      signal(),
    ),
  );
  journey.advanceMorning();
  const first = Date.parse(
    (await settle(journey.home.clock.load(signal()))).server_time,
  );
  f.source.advanceNight();
  journey.advanceMorning();
  expect(
    Date.parse((await settle(journey.home.clock.load(signal()))).server_time),
  ).toBeGreaterThanOrEqual(first);
  expect(f.source.signup.today).toBe('2026-11-17');
  expect(
    (await settle(journey.home.settings!.birthDate!.load(signal()))).today,
  ).toBe('2026-11-17');
  expect((await settle(journey.home.fortune.load(signal()))).date).toBe(
    '2026-11-17',
  );
  expect(
    (await settle(journey.home.settings!.loadMe(signal()))).user,
  ).toMatchObject({
    id: identity.id,
    email: 'joined@example.com',
    stats: { night_count: 1, counted_sheep_total: 3, worry_record_count: 1 },
  });
  await settle(f.connection.device.refresh());
  expect(f.alarms.size).toBe(1);
});
it('does not recreate a joined journey on duplicate begin or expose its records to a new account', async () => {
  const a = fixture('night'),
    b = fixture('night');
  a.source.onboarding.begin(
    { id: 'a', email: 'a@example.com' },
    { birth_date: '2001-03-12', edits_remaining: 1, zodiac: 'pisces' },
  );
  const original = a.source.getJourney()!;
  await settle(
    original.home.cards!.createWritingSession().text.submit(
      {
        kind: 'text',
        category_id: 'career',
        content: { text: '첫 계정의 카드' },
      },
      'account-a-writing',
      signal(),
    ),
  );
  expect(
    (await settle(original.home.cards!.load({}, signal()))).items,
  ).toHaveLength(1);
  a.source.onboarding.begin(
    { id: 'ignored', email: 'ignored@example.com' },
    { birth_date: '2002-04-10', edits_remaining: 1, zodiac: 'aries' },
  );
  expect(a.source.getJourney()).toBe(original);
  b.source.onboarding.begin(
    { id: 'b', email: 'b@example.com' },
    { birth_date: '2002-04-10', edits_remaining: 1, zodiac: 'aries' },
  );
  expect(b.source.getJourney()).not.toBe(original);
  expect(
    (await settle(b.source.getJourney()!.home.settings!.loadMe(signal()))).user,
  ).toMatchObject({
    id: 'b',
    email: 'b@example.com',
    birth_date: '2002-04-10',
    stats: { night_count: 0 },
  });
  expect(
    (await settle(b.source.getJourney()!.home.cards!.load({}, signal()))).items,
  ).toEqual([]);
});

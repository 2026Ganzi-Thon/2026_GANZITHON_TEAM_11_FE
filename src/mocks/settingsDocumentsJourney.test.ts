import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
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
it('uses the joined account email and signup document source, revokes old document access on withdrawal, and separates the next account', async () => {
  const account = createMockReminder(),
    source = createMockSignupJourney({
      ...account,
      ...createReminderConnection(
        account,
        createDeviceReminder(storedDevice().port),
      ),
    });
  source.onboarding.begin(
    { id: 'joined', email: 'joined@example.com' },
    { birth_date: '2004-05-14', edits_remaining: 1, zodiac: 'taurus' },
  );
  source.onboarding.skip();
  await jest.runAllTimersAsync();
  const settings = source.getJourney()!.home.settings!;
  expect((await settle(settings.loadMe(signal()))).user.email).toBe(
    'joined@example.com',
  );
  const joinedDocs = await settle(source.signup.loadDocuments(signal()));
  expect(await settle(settings.documents!.load(signal()))).toEqual(joinedDocs);
  const original = source.signup;
  const old = settings.documents!;
  await settle(settings.withdrawal!.withdraw(signal()));
  await expect(old.load(signal())).rejects.toMatchObject({
    code: 'ACCOUNT_WITHDRAWN',
  });
  await expect(original.loadDocuments(signal())).rejects.toMatchObject({
    code: 'ACCOUNT_WITHDRAWN',
  });
  source.onboarding.begin(
    { id: 'next', email: 'next@example.com' },
    { birth_date: '2000-01-01', edits_remaining: 1, zodiac: 'capricorn' },
  );
  source.onboarding.skip();
  await jest.runAllTimersAsync();
  const next = source.getJourney()!.home.settings!;
  expect((await settle(next.loadMe(signal()))).user.email).toBe(
    'next@example.com',
  );
  expect(await settle(next.documents!.load(signal()))).toEqual(joinedDocs);
});

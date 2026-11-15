import { beforeEach, afterEach, expect, it, jest } from '@jest/globals';
import { createMockSignupOnboarding } from './signupOnboarding';
import { createMockReminder } from './reminder';
import { createReminderConnection } from '../notifications/connection';
import { createDeviceReminder } from '../notifications/service';
import { fakeDevice } from '../notifications/__tests__/fakeDevice';
import { previewZodiac } from '../features/birthDate/zodiac';
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});
it('seeds the birth profile without consuming its edit and shares future profile and reminder changes with the home', async () => {
  const account = createMockReminder(),
    native = fakeDevice(),
    connected = createReminderConnection(
      account,
      createDeviceReminder(native.port),
    );
  const source = createMockSignupOnboarding({ ...account, ...connected });
  const date = '2001-03-12';
  source.onboarding.begin(
    { id: 'joined', email: 'joined@example.com' },
    { birth_date: date, edits_remaining: 1, zodiac: previewZodiac(date) },
  );
  const home = source.onboarding.getSnapshot().home!,
    signal = new AbortController().signal;
  const load = home.settings!.loadMe(signal);
  await jest.runAllTimersAsync();
  expect((await load).user).toMatchObject({
    id: 'joined',
    email: 'joined@example.com',
    birth_date: date,
    birth_date_edits_remaining: 1,
    stats: { night_count: 0 },
  });
  const saved = home.settings!.birthDate!.save('2002-04-10', signal);
  await jest.runAllTimersAsync();
  await saved;
  const me = home.settings!.loadMe(signal),
    fortune = home.fortune.load(signal);
  await jest.runAllTimersAsync();
  expect((await me).user.birth_date_edits_remaining).toBe(0);
  expect((await me).user.birth_date).toBe('2002-04-10');
  expect((await fortune).zodiac).toBe(previewZodiac('2002-04-10'));
  const on = home.settings!.reminder!.save(
    { enabled: true, local_time: '22:45' },
    signal,
  );
  await jest.runAllTimersAsync();
  await on;
  const refreshed = connected.device.refresh();
  await jest.runAllTimersAsync();
  await refreshed;
  expect(account.readSnapshot()).toEqual({
    enabled: true,
    local_time: '22:45',
  });
  expect([...native.records.values()].map((r) => r.localTime)).toEqual([
    '22:45',
  ]);
  const current = home.settings!.loadMe(signal);
  await jest.runAllTimersAsync();
  expect((await current).reminder).toEqual(account.readSnapshot());
});

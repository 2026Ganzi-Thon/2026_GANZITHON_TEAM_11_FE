import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import type { BirthDateResult } from '../birthDate/types';
import { createSignupOnboarding } from './onboarding';
import { createReminderConnection } from '../../notifications/connection';
import { createDeviceReminder } from '../../notifications/service';
import { storedDevice } from '../../notifications/__tests__/storedDevice';
import { deferred, scheduled } from '../../notifications/__tests__/fakeDevice';
import { createMockReminder } from '../../mocks/reminder';
import { createMockHome } from '../../mocks/firstNightHome';
import { ApiError } from '../../api/errors';
const registration = { id: 'new-account', email: 'new@example.com' };
const birth = {
  birth_date: '2002-06-15',
  edits_remaining: 1,
  zodiac: 'gemini',
} as const;
const drain = () => jest.runAllTimersAsync();
function fixture(scenario: 'day' | 'night' = 'day', failure = false) {
  const native = storedDevice();
  native.records.set('other', scheduled('other'));
  const account = createMockReminder(failure ? 'lost-response' : 'success');
  const save = jest.spyOn(account, 'save');
  const connected = createReminderConnection(
    account,
    createDeviceReminder(native.port),
  );
  const home = createMockHome(scenario);
  const load = jest.spyOn(home.clock, 'load');
  const makeHome = jest.fn(
    (_registration: typeof registration, _birth: BirthDateResult) => home,
  );
  const c = createSignupOnboarding({ ...account, ...connected }, makeHome);
  c.start();
  c.begin(registration, birth);
  return { ...native, account, save, connected, home, load, makeHome, c };
}
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});
it('chooses time without requesting permission or writing the account; cancelling restores the saved selection', async () => {
  const f = fixture();
  expect(f.c.getSnapshot()).toMatchObject({
    stage: 'choice',
    localTime: '23:00',
  });
  f.c.openTime();
  f.c.changeTime('minute', 15);
  f.c.back();
  f.c.openTime();
  expect(f.c.getSnapshot().draftTime.minute).toBe(0);
  f.c.changeTime('minute', 30);
  f.c.confirmTime();
  expect(f.c.getSnapshot()).toMatchObject({
    stage: 'choice',
    localTime: '23:30',
  });
  expect(f.port.requestPermission).not.toHaveBeenCalled();
  expect(f.save).not.toHaveBeenCalled();
});
it('allows explicitly, shares the selected setting, confirms an actual alarm and shows the daytime intro once', async () => {
  const f = fixture();
  f.c.openTime();
  f.c.changeTime('minute', 15);
  f.c.confirmTime();
  f.c.allow();
  f.c.allow();
  await drain();
  expect(f.save).toHaveBeenCalledTimes(1);
  expect(f.account.readSnapshot()).toEqual({
    enabled: true,
    local_time: '23:15',
  });
  expect(f.alarms.get('yangsebam.night-reminder.daily')?.localTime).toBe(
    '23:15',
  );
  expect(f.c.getSnapshot()).toMatchObject({
    stage: 'intro',
    intent: 'allow',
    busy: false,
  });
  expect(f.makeHome).toHaveBeenCalledWith(registration, birth);
  f.c.acknowledge();
  f.c.stop();
  f.c.start();
  f.c.begin(registration, birth);
  expect(f.c.getSnapshot().stage).toBe('home');
  expect(f.save).toHaveBeenCalledTimes(1);
  expect(f.records.has('other')).toBe(true);
});
it.each(['day', 'night'] as const)(
  'skips without a permission prompt and uses %s server time for the destination',
  async (scenario) => {
    const f = fixture(scenario);
    f.c.skip();
    await drain();
    expect(f.port.requestPermission).not.toHaveBeenCalled();
    expect(f.alarms.size).toBe(0);
    expect(f.c.getSnapshot().stage).toBe(scenario === 'day' ? 'intro' : 'home');
    expect(f.account.readSnapshot()).toEqual({
      enabled: false,
      local_time: null,
    });
  },
);
it('does not promise delivery after permission denial and can continue without notifications', async () => {
  const f = fixture();
  f.setPermission({ status: 'denied', canAskAgain: false, channel: 'enabled' });
  f.c.allow();
  await drain();
  expect(f.c.getSnapshot()).toMatchObject({
    stage: 'choice',
    retry: 'allow',
    intent: 'allow',
  });
  expect(f.c.getSnapshot().error).toMatch(/권한/);
  expect(f.account.readSnapshot().enabled).toBe(true);
  expect(f.alarms.size).toBe(0);
  f.c.skip();
  await drain();
  expect(f.c.getSnapshot()).toMatchObject({ stage: 'intro', intent: 'skip' });
  expect(f.account.readSnapshot().enabled).toBe(false);
});
it('keeps failed native registration separate from a committed setting and retries actual scheduling', async () => {
  const f = fixture();
  f.registerAlarm
    .mockRejectedValueOnce(new Error('AlarmManager'))
    .mockRejectedValueOnce(new Error('AlarmManager'));
  f.c.allow();
  await drain();
  expect(f.c.getSnapshot()).toMatchObject({ stage: 'choice', retry: 'device' });
  expect(f.records.size).toBe(2);
  expect(f.alarms.size).toBe(0);
  expect(f.save).toHaveBeenCalledTimes(1);
  f.c.retry();
  await drain();
  expect(f.c.getSnapshot().stage).toBe('choice');
  expect(f.alarms.size).toBe(0);
  f.c.retry();
  await drain();
  expect(f.c.getSnapshot().stage).toBe('intro');
  expect(f.alarms.size).toBe(1);
  expect(f.save).toHaveBeenCalledTimes(1);
});
it('recovers an uncertain write with the same desired setting before continuing', async () => {
  const f = fixture('day', true);
  f.c.allow();
  await drain();
  expect(f.c.getSnapshot().stage).toBe('choice');
  expect(f.c.getSnapshot().retry).toBe('allow');
  f.c.retry();
  await drain();
  expect(f.c.getSnapshot().stage).toBe('intro');
  expect(f.save.mock.calls.map((x) => x[0])).toEqual([
    { enabled: true, local_time: '23:00' },
    { enabled: true, local_time: '23:00' },
  ]);
  expect(f.alarms.size).toBe(1);
});
it('retries only clock lookup after notification success when server time cannot be confirmed', async () => {
  const f = fixture();
  f.load.mockRejectedValueOnce(new ApiError('network'));
  f.c.allow();
  await drain();
  expect(f.c.getSnapshot()).toMatchObject({ retry: 'clock', stage: 'choice' });
  f.c.retry();
  await drain();
  expect(f.c.getSnapshot().stage).toBe('intro');
  expect(f.save).toHaveBeenCalledTimes(1);
  expect(f.load).toHaveBeenCalledTimes(2);
});
it('aborts account work on stop and ignores a late success even after restarting', async () => {
  const f = fixture(),
    late = deferred<{ enabled: boolean; local_time: string | null }>();
  f.save.mockImplementationOnce(() => late.promise);
  f.c.allow();
  await drain();
  expect(f.save).toHaveBeenCalledTimes(1);
  f.c.stop();
  expect(f.save.mock.calls[0][1].aborted).toBe(true);
  f.c.start();
  late.resolve({ enabled: true, local_time: '23:00' });
  await drain();
  expect(f.c.getSnapshot()).toMatchObject({ stage: 'choice', busy: false });
  expect(f.load).not.toHaveBeenCalled();
});
it.each([
  ['2026-11-16T03:59:59+09:00', 'night', 'home'],
  ['2026-11-16T04:00:00+09:00', 'day', 'intro'],
  ['2026-11-16T20:59:59+09:00', 'day', 'intro'],
  ['2026-11-16T21:00:00+09:00', 'night', 'home'],
] as const)(
  'uses the confirmed server boundary %s rather than the device clock',
  async (server_time, phase, stage) => {
    const f = fixture();
    f.load.mockResolvedValueOnce({
      server_time,
      phase,
      timezone: 'Asia/Seoul',
      user: { id: 'new-account', stats: { night_count: 0 } },
    });
    f.c.skip();
    await drain();
    expect(f.c.getSnapshot().stage).toBe(stage);
  },
);
it('does not navigate on inconsistent time metadata and retries lookup without another save', async () => {
  const f = fixture();
  f.load.mockResolvedValueOnce({
    server_time: '2026-11-16T12:00:00+09:00',
    phase: 'night',
    timezone: 'Asia/Seoul',
    user: { id: 'new-account', stats: { night_count: 0 } },
  });
  f.c.skip();
  await drain();
  expect(f.c.getSnapshot()).toMatchObject({ stage: 'choice', retry: 'clock' });
  f.c.retry();
  await drain();
  expect(f.c.getSnapshot().stage).toBe('intro');
  expect(f.save).toHaveBeenCalledTimes(1);
});
it('keeps OFF cancellation failures retryable instead of completing with a live alarm', async () => {
  const f = fixture();
  f.records.set('yangsebam.night-reminder.daily', scheduled());
  f.port.cancel.mockRejectedValueOnce(new Error('cancel failed'));
  f.c.skip();
  await drain();
  expect(f.c.getSnapshot()).toMatchObject({ stage: 'choice', retry: 'device' });
  expect(f.records.has('yangsebam.night-reminder.daily')).toBe(true);
  f.c.retry();
  await drain();
  expect(f.c.getSnapshot().stage).toBe('intro');
  expect([...f.records.keys()]).toEqual(['other']);
});

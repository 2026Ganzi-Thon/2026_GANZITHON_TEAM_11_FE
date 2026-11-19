import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { createMockSignupJourney } from './signupJourney';
import { createMockReminder } from './reminder';
import { createReminderConnection } from '../notifications/connection';
import { createDeviceReminder } from '../notifications/service';
import { storedDevice } from '../notifications/__tests__/storedDevice';
import { deferred, scheduled } from '../notifications/__tests__/fakeDevice';
import { complete, settle, signal } from './__tests__/nightHistory';

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
async function fixture() {
  const native = storedDevice(),
    account = createMockReminder();
  const connection = createReminderConnection(
    account,
    createDeviceReminder(native.port),
  );
  const source = createMockSignupJourney(
    { ...account, ...connection },
    'night',
  );
  source.onboarding.begin(
    { id: 'member-a', email: 'a@example.com' },
    { birth_date: '2001-03-12', edits_remaining: 1, zodiac: 'pisces' },
  );
  source.onboarding.skip();
  await jest.runAllTimersAsync();
  return { ...native, account, connection, source, old: source.getJourney()! };
}
async function login(
  source: ReturnType<typeof createMockSignupJourney>,
  email: string,
) {
  await settle(
    source.signup.login({ email, password: 'mock-password' }, signal()),
  );
  source.onLoginComplete();
  return source.getJourney()!;
}
it('keeps confirmed nights, reflections and cards, clears writing drafts and restores the same account after logout', async () => {
  const f = await fixture();
  const sheep = await complete(f.old.night, 3, '남아야 하는 고민');
  f.old.advanceMorning();
  await settle(
    f.old.home.morning.reflection!.save(sheep.night_id, 'smaller', signal()),
  );
  const writer = f.old.home.cards!.createWritingSession();
  const draft = writer.text.writeDraft({
    category_id: 'career',
    text: '접수된 카드',
  });
  await settle(
    writer.text.submit(
      { kind: 'text', category_id: 'career', content: { text: draft.text } },
      draft.operationKey,
      signal(),
    ),
  );
  f.old.night.cardWriting.choose({ category_id: 'career', kind: 'text' });
  f.old.night.textCards.writeDraft({
    category_id: 'career',
    text: '버려야 하는 초안',
  });
  const oldNightKey = f.old.night.textCards.readDraft().operationKey;
  await settle(
    f.connection.save({ enabled: true, local_time: '23:00' }, signal()),
  );
  f.records.set('foreign-feature', scheduled('foreign-feature', '19:00'));
  f.alarms.set('foreign-feature', scheduled('foreign-feature', '19:00'));

  await settle(f.old.home.settings!.logout!.logout(signal()));
  expect(f.source.getJourney()).toBeNull();
  expect(f.source.initialLoginEmail).toBe('a@example.com');
  expect([...f.alarms.keys()]).toEqual(['foreign-feature']);
  await expect(f.old.home.settings!.loadMe(signal())).rejects.toMatchObject({
    code: 'SIGNED_OUT',
  });

  const restored = await login(f.source, ' A@EXAMPLE.COM ');
  expect(restored.history.getStats()).toEqual({
    night_count: 1,
    counted_sheep_total: 3,
    worry_record_count: 1,
  });
  expect((await settle(restored.home.morning.loadFlock(signal())))[0].id).toBe(
    sheep.id,
  );
  expect(
    (await settle(restored.home.settings!.worries.load({}, signal()))).items[0],
  ).toMatchObject({
    worry_text: '남아야 하는 고민',
    reflection: { answer: 'smaller' },
  });
  expect(
    (await settle(restored.home.cards!.load({}, signal()))).items,
  ).toHaveLength(1);
  expect(restored.night.cardWriting.readChoice()).toBeNull();
  expect(restored.night.textCards.readDraft().text).toBe('');
  expect(restored.night.textCards.readDraft().operationKey).not.toBe(
    oldNightKey,
  );
  expect(
    (await settle(restored.home.settings!.loadMe(signal()))).user,
  ).toMatchObject({
    id: 'member-a',
    email: 'a@example.com',
    birth_date: '2001-03-12',
  });
  expect(f.account.readSnapshot()).toEqual({
    enabled: true,
    local_time: '23:00',
  });
  expect(f.alarms.size).toBe(2);
  await expect(f.old.home.settings!.loadMe(signal())).rejects.toMatchObject({
    code: 'SIGNED_OUT',
  });
});
it('isolates a different email and restores each account without leaking old action handles or deleting records', async () => {
  const f = await fixture();
  await complete(f.old.night, 3, 'A 계정 기록');
  await settle(f.old.home.settings!.logout!.logout(signal()));
  const b = await login(f.source, 'b@example.com');
  expect(b.history.getStats().night_count).toBe(0);
  expect((await settle(b.home.cards!.load({}, signal()))).items).toEqual([]);
  expect((await settle(b.home.settings!.loadMe(signal()))).user.email).toBe(
    'b@example.com',
  );
  await complete(b.night, 5, 'B 계정 기록');
  await settle(b.home.settings!.logout!.logout(signal()));
  const a = await login(f.source, 'a@example.com');
  expect(a.history.getStats().counted_sheep_total).toBe(3);
  await settle(a.home.settings!.withdrawal!.withdraw(signal()));
  const againB = await login(f.source, 'b@example.com');
  expect(againB.history.getStats().counted_sheep_total).toBe(5);
  await expect(b.home.settings!.loadMe(signal())).rejects.toMatchObject({
    code: 'SIGNED_OUT',
  });
});
it.each(['resolve', 'reject'] as const)(
  'aborts pending account work and ignores a late %s after logout and re-login',
  async (mode) => {
    const f = await fixture();
    const late = deferred<Awaited<ReturnType<typeof f.old.home.clock.load>>>();
    let captured: AbortSignal | undefined;
    f.old.home.clock.load = (signal) => {
      captured = signal;
      return late.promise;
    };
    const request = f.old.home.clock.load(signal());
    const rejected = expect(request).rejects.toMatchObject({ kind: 'aborted' });
    await settle(f.old.home.settings!.logout!.logout(signal()));
    await rejected;
    expect(captured?.aborted).toBe(true);
    const restored = await login(f.source, 'a@example.com');
    if (mode === 'resolve')
      late.resolve({
        server_time: '2026-11-16T12:30:00Z',
        timezone: 'Asia/Seoul',
        phase: 'night',
        user: { id: 'old', stats: { night_count: 999 } },
      });
    else late.reject(new Error('late failure'));
    await Promise.resolve();
    expect(restored.history.getStats().night_count).toBe(0);
    await expect(f.old.home.settings!.loadMe(signal())).rejects.toMatchObject({
      code: 'SIGNED_OUT',
    });
  },
);
it('keeps the account on failed device cleanup and preserves the original reminder preference across retries', async () => {
  const f = await fixture();
  await settle(
    f.connection.save({ enabled: true, local_time: '23:00' }, signal()),
  );
  f.port.cancel.mockRejectedValueOnce(new Error('device failure'));
  await expect(
    settle(f.old.home.settings!.logout!.logout(signal())),
  ).rejects.toThrow();
  expect(f.source.getJourney()).toBe(f.old);
  expect(f.source.getVersion()).toBe(0);
  await settle(f.old.home.settings!.logout!.logout(signal()));
  expect(f.alarms.size).toBe(0);
  await login(f.source, 'a@example.com');
  expect(f.account.readSnapshot()).toEqual({
    enabled: true,
    local_time: '23:00',
  });
  expect(f.alarms.size).toBe(1);
});
it('does not log out or clear records when cancelled before cleanup', async () => {
  const f = await fixture();
  const controller = new AbortController();
  controller.abort();
  await expect(
    f.old.home.settings!.logout!.logout(controller.signal),
  ).rejects.toMatchObject({ kind: 'aborted' });
  expect(f.source.getJourney()).toBe(f.old);
  expect(f.source.getVersion()).toBe(0);
});
it('uses a new confirmed reminder choice after cancelling a failed logout instead of restoring an old choice', async () => {
  const f = await fixture();
  const reminder = f.old.home.settings!.reminder!;
  await settle(reminder.save({ enabled: true, local_time: '23:00' }, signal()));
  f.port.cancel.mockRejectedValueOnce(new Error('device failure'));
  await expect(
    settle(f.old.home.settings!.logout!.logout(signal())),
  ).rejects.toThrow();
  // The confirmation is dismissed and the user explicitly saves OFF in settings.
  await settle(reminder.save({ enabled: false, local_time: null }, signal()));
  await settle(f.old.home.settings!.logout!.logout(signal()));
  await login(f.source, 'a@example.com');
  expect(f.account.readSnapshot()).toEqual({
    enabled: false,
    local_time: null,
  });
  expect(f.alarms.size).toBe(0);
});
it('rejects signing up again with an archived email instead of replacing its account', async () => {
  const f = await fixture();
  await complete(f.old.night, 3, '기존 계정 기록');
  await settle(f.old.home.settings!.logout!.logout(signal()));
  await expect(
    settle(
      f.source.signup.register(
        'new-registration',
        { email: ' A@EXAMPLE.COM ', password: 'mock-password' },
        signal(),
      ),
    ),
  ).rejects.toMatchObject({ code: 'EMAIL_ALREADY_USED' });
  const restored = await login(f.source, 'a@example.com');
  expect(restored.history.getStats().night_count).toBe(1);
});
it('cleans up a reminder restored by a cancelled login and leaves the login screen signed out', async () => {
  const f = await fixture();
  await settle(
    f.connection.save({ enabled: true, local_time: '23:00' }, signal()),
  );
  await settle(f.old.home.settings!.logout!.logout(signal()));
  const gate = deferred<void>();
  f.registerAlarm.mockImplementationOnce(async (request) => {
    f.alarms.set(request.id, scheduled(request.id, request.localTime));
    await gate.promise;
  });
  const controller = new AbortController();
  const pending = f.source.signup.login(
    { email: 'a@example.com', password: 'mock-password' },
    controller.signal,
  );
  const rejected = expect(pending).rejects.toMatchObject({ kind: 'aborted' });
  await jest.advanceTimersByTimeAsync(1500);
  expect(f.alarms.size).toBe(1);
  controller.abort();
  gate.resolve();
  await rejected;
  await jest.runAllTimersAsync();
  expect(f.source.getJourney()).toBeNull();
  expect(f.alarms.size).toBe(0);
  await login(f.source, 'a@example.com');
  expect(f.alarms.size).toBe(1);
});

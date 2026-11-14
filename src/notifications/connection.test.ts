import { expect, it, jest } from '@jest/globals';
import { createDeviceReminder } from './service';
import { createReminderConnection } from './connection';
import { fakeDevice } from './__tests__/fakeDevice';
import { ApiError } from '../api/errors';
import type { ReminderSetting } from './types';
function account() {
  let current: ReminderSetting = { enabled: false, local_time: null };
  return {
    load: jest
      .fn<(signal: AbortSignal) => Promise<ReminderSetting>>()
      .mockImplementation(async () => ({ ...current })),
    save: jest
      .fn<
        (
          target: ReminderSetting,
          signal: AbortSignal,
        ) => Promise<ReminderSetting>
      >()
      .mockImplementation(async (target) => {
        current = { ...target };
        return { ...current };
      }),
    set: (value: ReminderSetting) => {
      current = { ...value };
    },
  };
}
const on = { enabled: true, local_time: '23:15' };
it('keeps a committed desired setting successful when scheduling fails, then retries only device reconciliation', async () => {
  const backend = account(),
    { port, records } = fakeDevice();
  port.schedule.mockRejectedValueOnce(new Error('native scheduling failed'));
  const connected = createReminderConnection(
    backend,
    createDeviceReminder(port),
  );
  await expect(
    connected.save(on, new AbortController().signal),
  ).resolves.toEqual(on);
  expect(connected.device.getSnapshot().phase).toBe('error');
  await connected.device.refresh();
  expect(connected.device.getSnapshot()).toMatchObject({
    phase: 'ready',
    state: { state: 'scheduled', localTime: '23:15' },
  });
  expect(backend.save).toHaveBeenCalledTimes(1);
  expect(records.size).toBe(1);
});
it('rechecks a committed but lost write and applies its actual setting without silently confirming the write receipt', async () => {
  const backend = account(),
    { port, records } = fakeDevice();
  backend.save.mockImplementationOnce(async (target) => {
    backend.set(target);
    throw new ApiError('network');
  });
  const connected = createReminderConnection(
    backend,
    createDeviceReminder(port),
  );
  await expect(
    connected.save(on, new AbortController().signal),
  ).rejects.toMatchObject({ kind: 'network' });
  expect(connected.device.getSnapshot()).toMatchObject({
    state: { state: 'scheduled' },
  });
  expect(records.size).toBe(1);
});
it('requests permission only on explicit action and reapplies the saved target instead of an unsaved draft', async () => {
  const backend = account(),
    { port, setPermission } = fakeDevice();
  setPermission({
    status: 'undetermined',
    canAskAgain: true,
    channel: 'missing',
  });
  const connected = createReminderConnection(
    backend,
    createDeviceReminder(port),
  );
  await connected.device.refresh();
  expect(port.requestPermission).not.toHaveBeenCalled();
  port.requestPermission.mockImplementationOnce(async () => {
    setPermission({ status: 'granted', canAskAgain: true, channel: 'enabled' });
    return port.readPermission();
  });
  await connected.device.requestPermission();
  expect(connected.device.getSnapshot()).toMatchObject({
    phase: 'ready',
    state: { state: 'off' },
    permission: { status: 'granted' },
  });
  expect(backend.save).not.toHaveBeenCalled();
  expect(port.schedule).not.toHaveBeenCalled();
});
it('serializes a foreground refresh after a save and captures queued inputs', async () => {
  const backend = account(),
    { port, records } = fakeDevice();
  const connected = createReminderConnection(
    backend,
    createDeviceReminder(port),
  );
  const target = { ...on };
  const saved = connected.save(target, new AbortController().signal);
  const refreshed = connected.device.refresh();
  target.local_time = '04:00';
  await saved;
  await refreshed;
  expect([...records.values()][0].localTime).toBe('23:15');
  expect(connected.device.getSnapshot()).toMatchObject({
    state: { state: 'scheduled', localTime: '23:15' },
  });
});
it('clears an old schedule when OFF even if a separate permission read fails', async () => {
  const backend = account(),
    { port, records } = fakeDevice();
  const connected = createReminderConnection(
    backend,
    createDeviceReminder(port),
  );
  await connected.save(on, new AbortController().signal);
  port.readPermission.mockRejectedValue(new Error('read unavailable'));
  await connected.save(
    { enabled: false, local_time: null },
    new AbortController().signal,
  );
  expect(records.size).toBe(0);
  expect(connected.device.getSnapshot()).toMatchObject({
    phase: 'ready',
    state: { state: 'off' },
    permission: null,
  });
});
it('does not write an already cancelled queued request', async () => {
  const backend = account(),
    { port } = fakeDevice(),
    abort = new AbortController();
  abort.abort();
  const connected = createReminderConnection(
    backend,
    createDeviceReminder(port),
  );
  await expect(connected.save(on, abort.signal)).rejects.toMatchObject({
    kind: 'aborted',
  });
  expect(backend.save).not.toHaveBeenCalled();
});
it('uses an authoritative read after a mismatched response rather than scheduling the response value', async () => {
  const backend = account(),
    { port, records } = fakeDevice();
  backend.save.mockImplementationOnce(async (target) => {
    backend.set(target);
    return { enabled: true, local_time: '23:30' };
  });
  const connected = createReminderConnection(
    backend,
    createDeviceReminder(port),
  );
  await expect(
    connected.save(on, new AbortController().signal),
  ).rejects.toMatchObject({ kind: 'invalid-response' });
  expect([...records.values()][0].localTime).toBe('23:15');
  expect(backend.save).toHaveBeenCalledTimes(1);
});

import { expect, it } from '@jest/globals';
import { createDeviceReminder } from './service';
import { fakeDevice, scheduled } from './__tests__/fakeDevice';
import type { DevicePermission } from './types';
const on = { enabled: true, local_time: '23:15' },
  off = { enabled: false, local_time: null };
it('registers once, recovers the same OS request after a restart, and preserves unrelated notifications', async () => {
  const { port, records } = fakeDevice();
  records.set('unrelated', scheduled('unrelated'));
  records.set(
    'yangsebam.night-reminder.old',
    scheduled('yangsebam.night-reminder.old'),
  );
  const first = await createDeviceReminder(port).sync(on);
  expect(first).toEqual({
    state: 'scheduled',
    id: 'yangsebam.night-reminder.daily',
    localTime: '23:15',
    delivery: 'bestEffort',
  });
  expect([...records.keys()]).toEqual([
    'unrelated',
    'yangsebam.night-reminder.daily',
  ]);
  await createDeviceReminder(port).sync(on);
  expect(port.schedule).toHaveBeenCalledTimes(1);
  expect(port.schedule).toHaveBeenCalledWith({
    id: 'yangsebam.night-reminder.daily',
    localTime: '23:15',
    hour: 23,
    minute: 15,
  });
  expect(port.requestPermission).not.toHaveBeenCalled();
});
it('turns OFF even when permission reads would fail, without touching another feature', async () => {
  const { port, records } = fakeDevice();
  records.set('unrelated', scheduled('unrelated'));
  records.set('yangsebam.night-reminder.daily', scheduled());
  port.readPermission.mockRejectedValue(
    new Error('permission read unavailable'),
  );
  expect(await createDeviceReminder(port).sync(off)).toEqual({ state: 'off' });
  expect([...records.keys()]).toEqual(['unrelated']);
  expect(port.readPermission).not.toHaveBeenCalled();
});
it.each([
  { status: 'denied', canAskAgain: false, channel: 'enabled' },
  { status: 'undetermined', canAskAgain: true, channel: 'missing' },
  { status: 'granted', canAskAgain: true, channel: 'blocked' },
] satisfies DevicePermission[])(
  'clears pending reminders and reports %p without prompting',
  async (permission) => {
    const { port, records, setPermission } = fakeDevice();
    setPermission(permission);
    records.set('yangsebam.night-reminder.daily', scheduled());
    expect(await createDeviceReminder(port).sync(on)).toEqual({
      state: 'permission-required',
      permission,
    });
    expect(records.size).toBe(0);
    expect(port.schedule).not.toHaveBeenCalled();
    expect(port.requestPermission).not.toHaveBeenCalled();
  },
);
it('does not silently reinterpret KST as another device timezone', async () => {
  const { port, records } = fakeDevice();
  records.set('yangsebam.night-reminder.daily', scheduled());
  port.timeZone.mockReturnValue('America/New_York');
  expect(await createDeviceReminder(port).sync(on)).toEqual({
    state: 'time-zone-required',
  });
  expect(records.size).toBe(0);
  expect(port.schedule).not.toHaveBeenCalled();
});
it('replaces an old time using the same identifier', async () => {
  const { port, records } = fakeDevice();
  records.set('yangsebam.night-reminder.daily', scheduled());
  await createDeviceReminder(port).sync({ enabled: true, local_time: '00:45' });
  expect([...records.values()]).toEqual([
    scheduled('yangsebam.night-reminder.daily', '00:45'),
  ]);
  expect(port.cancel).not.toHaveBeenCalled();
});
it('recovers a schedule reply lost after native commit without adding another request', async () => {
  const { port, records } = fakeDevice();
  port.schedule.mockImplementationOnce(async (request) => {
    records.set(request.id, scheduled(request.id, request.localTime));
    throw new Error('lost reply');
  });
  const device = createDeviceReminder(port);
  await expect(device.sync(on)).rejects.toMatchObject({ code: 'schedule' });
  expect(await device.sync(on)).toMatchObject({ state: 'scheduled' });
  expect(records.size).toBe(1);
  expect(port.schedule).toHaveBeenCalledTimes(1);
});
it('retries partial duplicate cleanup without replacing an already correct request', async () => {
  const { port, records } = fakeDevice();
  records.set('yangsebam.night-reminder.daily', scheduled());
  records.set(
    'yangsebam.night-reminder.old',
    scheduled('yangsebam.night-reminder.old'),
  );
  port.cancel.mockRejectedValueOnce(new Error('failed cleanup'));
  const device = createDeviceReminder(port);
  await expect(device.sync(on)).rejects.toMatchObject({ code: 'cancel' });
  await expect(device.sync(on)).resolves.toMatchObject({ state: 'scheduled' });
  expect(records.size).toBe(1);
  expect(port.schedule).not.toHaveBeenCalled();
});
it('verifies actual registration instead of trusting a returned ID', async () => {
  const { port } = fakeDevice();
  port.schedule.mockResolvedValue('yangsebam.night-reminder.daily');
  await expect(createDeviceReminder(port).sync(on)).rejects.toMatchObject({
    code: 'verification',
  });
});
it('does not claim OFF when native cancellation did not take effect', async () => {
  const { port, records } = fakeDevice();
  records.set('yangsebam.night-reminder.daily', scheduled());
  port.cancel.mockResolvedValue(undefined);
  await expect(createDeviceReminder(port).sync(off)).rejects.toMatchObject({
    code: 'verification',
  });
});
it('rejects invalid target and malformed permission before mutating native schedules', async () => {
  const { port } = fakeDevice();
  const device = createDeviceReminder(port);
  await expect(
    device.sync({ enabled: true, local_time: '24:00' }),
  ).rejects.toMatchObject({ code: 'invalid-setting' });
  port.readPermission.mockResolvedValue({
    status: 'unknown',
    channel: 'enabled',
    canAskAgain: true,
  } as unknown as DevicePermission);
  await expect(device.sync(on)).rejects.toMatchObject({ code: 'permission' });
  expect(port.schedule).not.toHaveBeenCalled();
  expect(port.cancel).not.toHaveBeenCalled();
});
it('only prompts explicitly, creates the channel before the prompt, and respects permanent denial', async () => {
  const { port, setPermission } = fakeDevice();
  const device = createDeviceReminder(port);
  setPermission({ status: 'denied', canAskAgain: false, channel: 'missing' });
  await device.requestPermission();
  expect(port.requestPermission).not.toHaveBeenCalled();
  expect(port.ensureChannel).not.toHaveBeenCalled();
  await device.openSettings();
  expect(port.openSettings).toHaveBeenCalledTimes(1);
  setPermission({
    status: 'undetermined',
    canAskAgain: true,
    channel: 'missing',
  });
  port.requestPermission.mockResolvedValue({
    status: 'granted',
    canAskAgain: true,
    channel: 'enabled',
  });
  expect(await device.requestPermission()).toMatchObject({ status: 'granted' });
  expect(port.ensureChannel.mock.invocationCallOrder[0]).toBeLessThan(
    port.requestPermission.mock.invocationCallOrder[0],
  );
  expect(port.schedule).not.toHaveBeenCalled();
});
it.each(['read', 'channel', 'wrong-id'] as const)(
  'does not report a schedule after native %s failure',
  async (failure) => {
    const { port } = fakeDevice();
    if (failure === 'read')
      port.list.mockRejectedValue(new Error('failed read'));
    if (failure === 'channel')
      port.ensureChannel.mockRejectedValue(new Error('failed create'));
    if (failure === 'wrong-id')
      port.schedule.mockResolvedValue('unexpected-id');
    await expect(createDeviceReminder(port).sync(on)).rejects.toMatchObject({
      code: failure === 'wrong-id' ? 'verification' : failure,
    });
    if (failure !== 'wrong-id') expect(port.schedule).not.toHaveBeenCalled();
  },
);
it('does not treat a malformed OS list as an empty successful state', async () => {
  const { port } = fakeDevice();
  port.list.mockResolvedValue(undefined as never);
  await expect(createDeviceReminder(port).sync(off)).rejects.toMatchObject({
    code: 'read',
  });
  expect(port.cancel).not.toHaveBeenCalled();
});
it('keeps an obsolete request until the replacement is observed in the OS list', async () => {
  const { port, records } = fakeDevice();
  records.set(
    'yangsebam.night-reminder.old',
    scheduled('yangsebam.night-reminder.old'),
  );
  port.schedule.mockResolvedValue('yangsebam.night-reminder.daily');
  await expect(createDeviceReminder(port).sync(on)).rejects.toMatchObject({
    code: 'verification',
  });
  expect([...records.keys()]).toEqual(['yangsebam.night-reminder.old']);
  expect(port.cancel).not.toHaveBeenCalled();
});

import { expect, it } from '@jest/globals';
import { createDeviceReminder } from './service';
import { fakeDevice, scheduled, deferred } from './__tests__/fakeDevice';
const on = { enabled: true, local_time: '23:15' },
  off = { enabled: false, local_time: null };
it('serializes delayed ON and subsequent OFF so the last request removes the committed schedule', async () => {
  const { port, records } = fakeDevice(),
    started = deferred<void>(),
    release = deferred<void>();
  port.schedule.mockImplementationOnce(async (request) => {
    started.resolve();
    await release.promise;
    records.set(request.id, scheduled(request.id, request.localTime));
    return request.id;
  });
  const device = createDeviceReminder(port),
    first = device.sync(on);
  await started.promise;
  const last = device.sync(off);
  expect(port.cancel).not.toHaveBeenCalled();
  release.resolve();
  expect(await first).toMatchObject({ state: 'scheduled' });
  expect(await last).toEqual({ state: 'off' });
  expect(records.size).toBe(0);
});
it('captures a queued time before the caller edits it and keeps the queue usable after failure', async () => {
  const { port, records } = fakeDevice(),
    started = deferred<void>(),
    release = deferred<void>();
  port.schedule.mockImplementationOnce(async () => {
    started.resolve();
    await release.promise;
    throw new Error('failure');
  });
  const device = createDeviceReminder(port),
    first = device.sync(on);
  const failed = expect(first).rejects.toMatchObject({ code: 'schedule' });
  await started.promise;
  const next = { enabled: true, local_time: '00:45' };
  const second = device.sync(next);
  next.local_time = '01:15';
  release.resolve();
  await failed;
  expect(await second).toMatchObject({
    state: 'scheduled',
    localTime: '00:45',
  });
  expect([...records.values()]).toEqual([
    scheduled('yangsebam.night-reminder.daily', '00:45'),
  ]);
});
it.each(['permission', 'channel', 'timezone'] as const)(
  'removes a new request when %s changes during scheduling',
  async (changed) => {
    const { port, records, setPermission } = fakeDevice();
    port.schedule.mockImplementationOnce(async (request) => {
      records.set(request.id, scheduled(request.id, request.localTime));
      if (changed === 'permission')
        setPermission({
          status: 'denied',
          canAskAgain: false,
          channel: 'enabled',
        });
      else if (changed === 'channel')
        setPermission({
          status: 'granted',
          canAskAgain: true,
          channel: 'missing',
        });
      else port.timeZone.mockReturnValue('America/New_York');
      return request.id;
    });
    const result = await createDeviceReminder(port).sync(on);
    expect(result.state).toBe(
      changed === 'timezone' ? 'time-zone-required' : 'permission-required',
    );
    expect(records.size).toBe(0);
  },
);

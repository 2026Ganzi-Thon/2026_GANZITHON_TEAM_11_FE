import { expect, it } from '@jest/globals';
import { createDeviceReminder } from './service';
import { storedDevice } from './__tests__/storedDevice';
import { scheduled } from './__tests__/fakeDevice';
const on = { enabled: true, local_time: '23:15' };
const id = 'yangsebam.night-reminder.daily';
it.each([false, true])(
  'reregisters a stored request after alarm registration failed, including service restart=%s',
  async (restart) => {
    const { port, records, alarms, registerAlarm } = storedDevice();
    records.set('another-feature', scheduled('another-feature'));
    alarms.set('another-feature', scheduled('another-feature'));
    registerAlarm.mockRejectedValueOnce(
      new Error('AlarmManager failed after SDK write'),
    );
    let device = createDeviceReminder(port);
    await expect(device.sync(on)).rejects.toMatchObject({ code: 'schedule' });
    expect(records.get(id)).toMatchObject({ localTime: '23:15' });
    expect(alarms.has(id)).toBe(false);
    if (restart) device = createDeviceReminder(port);
    await expect(device.sync(on)).resolves.toMatchObject({
      state: 'scheduled',
      localTime: '23:15',
    });
    expect(alarms.get(id)).toMatchObject({ localTime: '23:15' });
    expect([...alarms.keys()]).toEqual(['another-feature', id]);
    expect([...records.keys()]).toEqual(['another-feature', id]);
    expect(port.schedule).toHaveBeenCalledTimes(2);
    expect(port.schedule.mock.calls[0][0]).toEqual(
      port.schedule.mock.calls[1][0],
    );
    expect(port.cancel).not.toHaveBeenCalledWith('another-feature');
  },
);
it('never reports scheduled while registration keeps failing even though the SDK record matches', async () => {
  const { port, records, alarms, registerAlarm } = storedDevice();
  registerAlarm.mockRejectedValue(new Error('AlarmManager unavailable'));
  const device = createDeviceReminder(port);
  for (let attempt = 0; attempt < 3; attempt++) {
    await expect(device.sync(on)).rejects.toMatchObject({ code: 'schedule' });
    expect(records.get(id)).toMatchObject({ localTime: '23:15' });
    expect(alarms.has(id)).toBe(false);
  }
  expect(port.schedule).toHaveBeenCalledTimes(3);
});
it('does not confirm a changed time from the SDK record when the actual alarm is still at the previous time', async () => {
  const { port, records, alarms, registerAlarm } = storedDevice();
  const device = createDeviceReminder(port);
  await device.sync(on);
  registerAlarm.mockRejectedValueOnce(new Error('changed alarm failed'));
  const changed = { enabled: true, local_time: '23:30' };
  await expect(device.sync(changed)).rejects.toMatchObject({
    code: 'schedule',
  });
  expect(records.get(id)?.localTime).toBe('23:30');
  expect(alarms.get(id)?.localTime).toBe('23:15');
  await expect(device.sync(changed)).resolves.toMatchObject({
    state: 'scheduled',
    localTime: '23:30',
  });
  expect(alarms.get(id)?.localTime).toBe('23:30');
  expect(alarms.size).toBe(1);
  await device.sync({ enabled: false, local_time: null });
  expect(alarms.size).toBe(0);
  expect(records.size).toBe(0);
});

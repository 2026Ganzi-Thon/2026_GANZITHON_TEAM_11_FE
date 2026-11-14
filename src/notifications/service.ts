import {
  matchesReminder,
  ownsReminder,
  REMINDER_ID,
  reminderTime,
} from './model';
import {
  DeviceReminderError,
  type DeviceReminderErrorCode,
  type DeviceReminderPort,
  type ReminderSetting,
  type DevicePermission,
  type DeviceReminderState,
  type ScheduledReminder,
} from './types';
/** One instance per application. Mutations outlive views and run serially. */
export function createDeviceReminder(port: DeviceReminderPort) {
  let queue: Promise<unknown> = Promise.resolve();
  function serial<T>(operation: () => Promise<T>): Promise<T> {
    const next = queue.then(operation);
    queue = next.catch(() => undefined);
    return next;
  }
  async function perform<T>(
    code: DeviceReminderErrorCode,
    operation: () => Promise<T>,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw error instanceof DeviceReminderError
        ? error
        : new DeviceReminderError(code);
    }
  }
  async function permission(): Promise<DevicePermission> {
    const value = await perform('permission', () => port.readPermission());
    return checkedPermission(value);
  }
  function checkedPermission(value: DevicePermission): DevicePermission {
    if (
      !value ||
      !['granted', 'denied', 'undetermined'].includes(value.status) ||
      typeof value.canAskAgain !== 'boolean' ||
      !['enabled', 'blocked', 'missing'].includes(value.channel)
    )
      throw new DeviceReminderError('permission');
    return { ...value };
  }
  async function list(): Promise<ScheduledReminder[]> {
    const values = await perform('read', () => port.list());
    if (
      !Array.isArray(values) ||
      values.some(
        (item) => !item || typeof item.id !== 'string' || !item.id.trim(),
      ) ||
      new Set(values.map((item) => item.id)).size !== values.length
    )
      throw new DeviceReminderError('read');
    return values.filter((item) => ownsReminder(item.id));
  }
  async function cancelAll(): Promise<void> {
    for (const item of await list())
      await perform('cancel', () => port.cancel(item.id));
    if ((await list()).length) throw new DeviceReminderError('verification');
  }
  function allowed(value: DevicePermission) {
    return value.status === 'granted' && value.channel !== 'blocked';
  }
  async function zoneIsKst(): Promise<boolean> {
    return perform('read', async () => port.timeZone() === 'Asia/Seoul');
  }
  async function sync(target: ReminderSetting): Promise<DeviceReminderState> {
    const time = reminderTime(target);
    if (!time) {
      await cancelAll();
      return { state: 'off' };
    }
    const localTime = target.local_time!;
    let current = await permission();
    if (!allowed(current)) {
      await cancelAll();
      return { state: 'permission-required', permission: current };
    }
    if (!(await zoneIsKst())) {
      await cancelAll();
      return { state: 'time-zone-required' };
    }
    await perform('channel', () => port.ensureChannel());
    current = await permission();
    if (!allowed(current)) {
      await cancelAll();
      return { state: 'permission-required', permission: current };
    }
    if (current.channel === 'missing') throw new DeviceReminderError('channel');
    const existing = await list();
    if (!existing.some((item) => matchesReminder(item, localTime))) {
      const id = await perform('schedule', () =>
        port.schedule({ id: REMINDER_ID, ...time, localTime }),
      );
      if (id !== REMINDER_ID) throw new DeviceReminderError('verification');
    }
    // Permission/timezone can change while a native request is pending.
    current = await permission();
    if (!allowed(current) || current.channel === 'missing') {
      await cancelAll();
      return { state: 'permission-required', permission: current };
    }
    if (!(await zoneIsKst())) {
      await cancelAll();
      return { state: 'time-zone-required' };
    }
    const registered = await list();
    if (!registered.some((item) => matchesReminder(item, localTime)))
      throw new DeviceReminderError('verification');
    for (const item of registered)
      if (item.id !== REMINDER_ID)
        await perform('cancel', () => port.cancel(item.id));
    const actual = await list();
    if (actual.length !== 1 || !matchesReminder(actual[0], localTime))
      throw new DeviceReminderError('verification');
    return {
      state: 'scheduled',
      id: REMINDER_ID,
      localTime,
      delivery: 'bestEffort',
    };
  }
  return {
    sync: (target: ReminderSetting): Promise<DeviceReminderState> => {
      // Capture primitives before waiting in the queue; never observe a later edit.
      const captured = target && {
        enabled: target.enabled,
        local_time: target.local_time,
      };
      return serial(() => sync(captured));
    },
    readPermission: () => serial(permission),
    requestPermission: () =>
      serial(async () => {
        const current = await permission();
        if (
          current.status === 'granted' ||
          !current.canAskAgain ||
          current.channel === 'blocked'
        )
          return current;
        await perform('channel', () => port.ensureChannel());
        return checkedPermission(
          await perform('permission', () => port.requestPermission()),
        );
      }),
    openSettings: () =>
      serial(() => perform('settings', () => port.openSettings())),
  };
}

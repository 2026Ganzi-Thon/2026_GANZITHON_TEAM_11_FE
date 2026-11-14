import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Linking, Platform } from 'react-native';
import {
  ownsReminder,
  REMINDER_CHANNEL,
  REMINDER_ID,
  reminderTime,
} from './model';
import {
  DeviceReminderError,
  type DevicePermission,
  type DeviceReminderPort,
  type ScheduledReminder,
} from './types';
function android() {
  if (Platform.OS !== 'android') throw new DeviceReminderError('platform');
}
async function permission(
  value: Notifications.NotificationPermissionsStatus,
): Promise<DevicePermission> {
  if (
    !value ||
    !['granted', 'denied', 'undetermined'].includes(value.status) ||
    typeof value.canAskAgain !== 'boolean' ||
    value.granted !== (value.status === 'granted')
  )
    throw new DeviceReminderError('permission');
  if (Number(Platform.Version) < 26)
    return {
      status: value.status,
      canAskAgain: value.canAskAgain,
      channel: 'enabled',
    };
  const channel =
    await Notifications.getNotificationChannelAsync(REMINDER_CHANNEL);
  if (
    channel &&
    (!Number.isInteger(channel.importance) ||
      channel.importance < AndroidImportance.NONE)
  )
    throw new DeviceReminderError('permission');
  return {
    status: value.status,
    canAskAgain: value.canAskAgain,
    channel: channel
      ? channel.importance === AndroidImportance.NONE
        ? 'blocked'
        : 'enabled'
      : 'missing',
  };
}
/** Creating this port does not request permission or schedule a reminder. */
export function createExpoAndroidPort(): DeviceReminderPort {
  return {
    readPermission: async () => {
      android();
      return permission(await Notifications.getPermissionsAsync());
    },
    requestPermission: async () => {
      android();
      return permission(await Notifications.requestPermissionsAsync());
    },
    ensureChannel: async () => {
      android();
      await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL, {
        name: '밤에 와 알림',
        importance: AndroidImportance.DEFAULT,
        sound: null,
        enableVibrate: false,
        showBadge: false,
      });
    },
    openSettings: async () => {
      android();
      await Linking.openSettings();
    },
    timeZone: () => {
      android();
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    },
    list: async () => {
      android();
      return (await Notifications.getAllScheduledNotificationsAsync()).map(
        (request): ScheduledReminder => {
          // Native payloads can include keys missing from the SDK's output union.
          const trigger = (
            request.trigger && typeof request.trigger === 'object'
              ? request.trigger
              : {}
          ) as Record<string, unknown>;
          const daily = trigger.type === 'daily';
          const channel = trigger.channelId;
          return {
            id: request.identifier,
            daily,
            channelId: typeof channel === 'string' ? channel : null,
            hour:
              daily &&
              typeof trigger.hour === 'number' &&
              Number.isInteger(trigger.hour)
                ? trigger.hour
                : null,
            minute:
              daily &&
              typeof trigger.minute === 'number' &&
              Number.isInteger(trigger.minute)
                ? trigger.minute
                : null,
            localTime:
              typeof request.content?.data?.local_time === 'string'
                ? request.content.data.local_time
                : null,
            version:
              typeof request.content?.data?.schema_version === 'number'
                ? request.content.data.schema_version
                : null,
            delivery:
              daily &&
              (trigger.delivery === undefined ||
                trigger.delivery === 'bestEffort')
                ? 'bestEffort'
                : daily && trigger.delivery === 'alarmClock'
                  ? 'alarmClock'
                  : null,
          };
        },
      );
    },
    schedule: async (request) => {
      android();
      const parts = reminderTime({
        enabled: true,
        local_time: request.localTime,
      });
      if (
        request.id !== REMINDER_ID ||
        request.hour !== parts?.hour ||
        request.minute !== parts?.minute
      )
        throw new DeviceReminderError('invalid-setting');
      return Notifications.scheduleNotificationAsync({
        identifier: REMINDER_ID,
        content: {
          title: '양 세는 밤',
          body: '오늘 밤도 양과 함께 쉬어 가요.',
          sound: false,
          data: { schema_version: 1, local_time: request.localTime },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: request.hour,
          minute: request.minute,
          channelId: REMINDER_CHANNEL,
          delivery: 'bestEffort',
        },
      });
    },
    cancel: async (id) => {
      android();
      if (!ownsReminder(id)) throw new DeviceReminderError('invalid-setting');
      await Notifications.cancelScheduledNotificationAsync(id);
    },
  };
}

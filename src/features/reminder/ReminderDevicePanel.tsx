import { useSyncExternalStore } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { ReminderDeviceConnection } from '../../notifications/connection';
import { Button } from '../../ui/Button';
import { theme } from '../../ui/theme';
export function ReminderDevicePanel({
  device,
}: {
  device: ReminderDeviceConnection;
}) {
  const snapshot = useSyncExternalStore(device.subscribe, device.getSnapshot);
  const permission = snapshot.permission;
  const permissionText = !permission
    ? '확인하지 못함'
    : permission.channel === 'blocked'
      ? '채널이 꺼져 있어요'
      : permission.status === 'granted'
        ? '허용됨'
        : permission.status === 'undetermined'
          ? '아직 요청하지 않음'
          : '권한 필요';
  const state = snapshot.state;
  return (
    <View style={styles.panel}>
      {snapshot.phase === 'checking' ? (
        <>
          <ActivityIndicator color={theme.color.primary} />
          <Text style={styles.body}>기기 알림 상태를 확인하고 있어요.</Text>
        </>
      ) : (
        <>
          <Text style={styles.body}>기기 알림 권한 · {permissionText}</Text>
          {snapshot.phase === 'error' ? (
            <>
              <Text accessibilityRole="alert" style={styles.body}>
                기기 예약 상태를 확인하지 못했어요.
              </Text>
              <Button
                label="기기 상태 다시 확인"
                onPress={() => void device.refresh()}
              />
            </>
          ) : (
            <>
              <Text style={styles.body}>
                {state?.state === 'scheduled'
                  ? `기기 예약 · 매일 ${state.localTime}`
                  : state?.state === 'off'
                    ? '기기 예약 · 꺼짐'
                    : state?.state === 'time-zone-required'
                      ? '기기 예약 · 시간대 확인 필요'
                      : '기기 예약 · 권한 필요'}
              </Text>
              {state?.state === 'time-zone-required' && (
                <Text style={styles.caption}>
                  기기 시간대를 한국 시간으로 바꾼 뒤 다시 확인해 주세요.
                </Text>
              )}
              {(!permission || state?.state === 'time-zone-required') && (
                <Button
                  label="기기 상태 다시 확인"
                  onPress={() => void device.refresh()}
                />
              )}
            </>
          )}
          {permission &&
            (permission.status !== 'granted' ||
              permission.channel === 'blocked') &&
            (permission.channel !== 'blocked' && permission.canAskAgain ? (
              <Button
                label="알림 권한 요청"
                onPress={() => void device.requestPermission()}
              />
            ) : (
              <Button
                label="기기 알림 설정 열기"
                onPress={() => void device.openSettings()}
              />
            ))}
        </>
      )}
      <Text style={styles.caption}>
        희망 설정은 mock 계정에 저장하고, 기기 예약은 실제로 적용해요. 알림은
        한국 시간 기준이며 절전 설정에 따라 늦게 도착할 수 있어요.
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  panel: { backgroundColor: '#2B3591', borderRadius: 4, padding: 16, gap: 12 },
  body: {
    fontFamily: theme.font,
    color: theme.color.text,
    fontSize: 18,
    lineHeight: 27,
  },
  caption: {
    fontFamily: theme.font,
    color: theme.color.muted,
    fontSize: 16,
    lineHeight: 25,
  },
});

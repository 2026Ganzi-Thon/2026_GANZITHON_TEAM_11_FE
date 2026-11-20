import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Button } from '../../ui/Button';
import { NightScreen } from '../../ui/NightScreen';
import { theme } from '../../ui/theme';
import { Header } from '../settings/Header';
import type { ReminderActions } from './types';
import { reminderLabel } from './time';
import { useReminder } from './useReminder';
import { ReminderDevicePanel } from './ReminderDevicePanel';
import { TimeWheel } from './TimeWheel';
export function ReminderScreen(props: {
  actions: ReminderActions;
  onBack: () => void;
  modal?: boolean;
}) {
  const [source, setSource] = useState({ actions: props.actions, version: 0 });
  if (source.actions !== props.actions)
    setSource({ actions: props.actions, version: source.version + 1 });
  return <ReminderSession key={source.version} {...props} />;
}
function ReminderSession({
  actions,
  onBack,
  modal = false,
}: {
  actions: ReminderActions;
  onBack: () => void;
  modal?: boolean;
}) {
  const flow = useReminder(actions, onBack);
  useEffect(() => {
    if (actions.device) void actions.device.refresh();
  }, [actions.device]);
  useEffect(() => {
    if (modal) return;
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      flow.back();
      return true;
    });
    return () => handler.remove();
  }, [flow, modal]);
  const editing = flow.phase === 'edit' || flow.phase === 'saving';
  const permissionText = {
    granted: '허용됨',
    denied: '권한 필요',
    undetermined: '아직 요청하지 않음',
    unknown: '확인하지 못함',
    loading: '확인 중',
  }[flow.permission];
  const content = (
    <NightScreen
      background={require('../../../assets/images/reminder/background.svg')}
    >
      <Header title="알림 시간" backLabel="알림 설정 닫기" onBack={flow.back} />
      {flow.phase === 'saving' && (
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="알림 설정 저장 중"
          accessibilityState={{ busy: true }}
          accessibilityLiveRegion="polite"
          style={styles.progress}
        >
          <ActivityIndicator accessible={false} color={theme.color.primary} />
          <Text style={styles.body}>알림 설정을 저장하고 있어요.</Text>
        </View>
      )}
      <ScrollView key={flow.phase} contentContainerStyle={styles.content}>
        {flow.phase === 'loading' || flow.phase === 'load-error' ? (
          <View style={styles.panel}>
            {flow.phase === 'loading' ? (
              <>
                <ActivityIndicator color={theme.color.primary} />
                <Text style={styles.body}>알림 설정을 불러오고 있어요.</Text>
              </>
            ) : (
              <>
                <Text style={styles.body} accessibilityRole="alert">
                  알림 설정을 불러오지 못했어요.
                </Text>
                <Button
                  label="알림 설정 다시 불러오기"
                  onPress={flow.retryLoad}
                />
              </>
            )}
          </View>
        ) : (
          <>
            {editing && (
              <>
                {flow.message && (
                  <View style={styles.panel}>
                    <Text accessibilityRole="alert" style={styles.body}>
                      {flow.message}
                    </Text>
                  </View>
                )}
                <View style={styles.toggle}>
                  <Text style={styles.body}>밤에 와 알림</Text>
                  <Switch
                    accessibilityLabel="밤에 와 알림"
                    value={flow.enabled}
                    onValueChange={flow.setEnabled}
                    disabled={flow.phase === 'saving'}
                    trackColor={{ false: '#4A5290', true: '#D6A8FF' }}
                    thumbColor="#242565"
                  />
                </View>
                <TimeWheel
                  value={flow.time}
                  disabled={!flow.enabled || flow.phase !== 'edit'}
                  onChange={flow.change}
                />
                <Text style={styles.caption}>
                  한국 시간 · 15분 단위로 선택해요.
                </Text>
              </>
            )}
            {flow.phase === 'uncertain' && (
              <View style={styles.panel}>
                <Text style={styles.title} accessibilityRole="alert">
                  저장 결과를 확인하지 못했어요.
                </Text>
                <Text style={styles.body}>
                  {flow.target && reminderLabel(flow.target)}
                </Text>
                <Text style={styles.body}>
                  같은 설정으로 다시 확인해 주세요. 설정으로 돌아가면 저장된
                  내용을 새로 불러와요.
                </Text>
                <Button
                  label="같은 설정으로 다시 확인"
                  onPress={() => void flow.save()}
                />
              </View>
            )}
            {flow.phase === 'saved' && (
              <View style={styles.panel}>
                <Text style={styles.title}>알림 희망 설정을 저장했어요.</Text>
                <Text style={styles.body}>
                  {flow.target && reminderLabel(flow.target)}
                </Text>
              </View>
            )}
          </>
        )}
        {actions.device ? (
          <ReminderDevicePanel device={actions.device} />
        ) : (
          <View style={styles.panel}>
            <Text style={styles.body}>기기 알림 권한 · {permissionText}</Text>
            <Text style={styles.caption}>
              희망 설정과 기기 권한은 별개예요. 이 미리보기에서는 권한 상태도
              예시이며 실제 알림은 예약하지 않아요.
            </Text>
            {flow.permission === 'unknown' && (
              <Button
                label="권한 상태 다시 확인"
                onPress={flow.retryPermission}
              />
            )}
          </View>
        )}
        <View style={styles.spacer} />
        {editing && (
          <Button
            label={flow.phase === 'saving' ? '저장 중' : '저장'}
            busy={flow.phase === 'saving'}
            onPress={() => void flow.save()}
          />
        )}
        {flow.phase === 'saved' && (
          <Button label="설정으로 돌아가기" onPress={flow.back} />
        )}
      </ScrollView>
    </NightScreen>
  );
  return modal ? (
    <Modal
      visible
      animationType="none"
      onRequestClose={flow.back}
      testID="reminder-modal"
      statusBarTranslucent
      navigationBarTranslucent
    >
      <StatusBar style="light" />
      {content}
    </Modal>
  ) : (
    <>
      <StatusBar style="light" />
      {content}
    </>
  );
}
const styles = StyleSheet.create({
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2B3591',
    borderRadius: 4,
    marginHorizontal: 20,
    marginVertical: 8,
    padding: 12,
    gap: 12,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 14,
  },
  panel: { backgroundColor: '#2B3591', borderRadius: 4, padding: 16, gap: 12 },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 12,
    backgroundColor: '#242565',
    borderRadius: 4,
  },
  title: {
    fontFamily: theme.font,
    fontSize: 20,
    lineHeight: 30,
    color: theme.color.text,
    fontWeight: '700',
  },
  body: {
    fontFamily: theme.font,
    fontSize: 18,
    lineHeight: 27,
    color: theme.color.text,
    flexShrink: 1,
  },
  caption: {
    fontFamily: theme.font,
    fontSize: 16,
    lineHeight: 25,
    color: theme.color.muted,
  },
  spacer: { flex: 1 },
});

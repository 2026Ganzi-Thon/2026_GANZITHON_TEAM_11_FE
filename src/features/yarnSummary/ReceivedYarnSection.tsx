import { Image } from 'expo-image';
import {
  AppState,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../ui/Button';
import { theme } from '../../ui/theme';
import { useReceivedYarn } from './useReceivedYarn';
import type { ReceivedYarnActions } from './types';
const number = new Intl.NumberFormat('ko-KR');
const seenError = '확인 상태가 저장됐는지 알 수 없어요.';
export function ReceivedYarnSection({
  actions,
  blocked = false,
}: {
  actions: ReceivedYarnActions;
  blocked?: boolean;
}) {
  const [foreground, setForeground] = useState(
    () => AppState.currentState === 'active',
  );
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) =>
      setForeground(state === 'active'),
    );
    return () => subscription.remove();
  }, []);
  const paused = blocked || !foreground;
  const flow = useReceivedYarn(actions, paused);
  const { summary } = flow;
  return (
    <>
      {flow.phase === 'loading' && (
        <Text style={styles.homeText} accessibilityLiveRegion="polite">
          받은 털실을 확인하고 있어요
        </Text>
      )}
      {flow.phase === 'error' && (
        <View style={styles.homePanel}>
          <Text style={styles.homeText} accessibilityRole="alert">
            받은 털실을 불러오지 못했어요
          </Text>
          <Button label="받은 털실 다시 불러오기" onPress={flow.retryLoad} />
        </View>
      )}
      {flow.seen === 'error' && !flow.visible && (
        <View style={styles.homePanel}>
          <Text style={styles.homeText} accessibilityRole="alert">
            {seenError}
          </Text>
          <Button label="확인 상태 다시 저장" onPress={flow.retrySeen} />
        </View>
      )}
      {flow.visible && !paused && summary && (
        <Modal
          transparent
          visible
          animationType="none"
          onShow={() => {
            if (AppState.currentState === 'active') flow.shown();
          }}
          onRequestClose={flow.dismiss}
          statusBarTranslucent
          navigationBarTranslucent
          testID="received-yarn-modal"
        >
          <SafeAreaView style={styles.shade}>
            <ScrollView contentContainerStyle={styles.scroll}>
              <View style={styles.popup} accessibilityViewIsModal>
                <Image
                  source={require('../../../assets/images/yarn-summary/popup.svg')}
                  style={StyleSheet.absoluteFill}
                  contentFit="fill"
                  accessible={false}
                />
                <Text style={styles.title} accessibilityRole="header">
                  털실 {number.format(summary.yarn_count)}개가 도착했어요
                </Text>
                <Text style={styles.subtitle}>
                  어젯밤 누군가 당신의 카드를 좋아했어요
                </Text>
                <View style={styles.summary}>
                  <Text style={styles.body}>
                    {summary.date.replaceAll('-', '.')} 집계
                  </Text>
                  <Text style={styles.body}>
                    {number.format(summary.sender_count)}명이 당신의 카드에
                    마음을 보냈어요.
                  </Text>
                  <Text style={styles.caption}>
                    보낸 사람의 이름은 알려드리지 않아요.
                  </Text>
                </View>
                {flow.seen === 'pending' && (
                  <Text style={styles.caption} accessibilityLiveRegion="polite">
                    확인 상태를 저장하고 있어요
                  </Text>
                )}
                {flow.seen === 'error' && (
                  <View style={styles.feedback}>
                    <Text style={styles.error} accessibilityRole="alert">
                      {seenError}
                    </Text>
                    <Text style={styles.caption}>
                      다시 시도하거나 창을 닫아도 괜찮아요.
                    </Text>
                    <Button
                      label="확인 상태 다시 저장"
                      onPress={flow.retrySeen}
                    />
                  </View>
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="받은 털실 닫기"
                  onPress={flow.dismiss}
                  style={styles.close}
                >
                  <Image
                    source={require('../../../assets/images/yarn-summary/close.svg')}
                    style={styles.closeIcon}
                    accessible={false}
                  />
                </Pressable>
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}
    </>
  );
}
const styles = StyleSheet.create({
  shade: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingVertical: 24,
  },
  popup: {
    width: '100%',
    maxWidth: 300,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 24,
    gap: 12,
    boxShadow: '5px 5px 0 #AFC0FF',
  },
  title: {
    fontFamily: theme.font,
    color: '#242565',
    fontSize: 22,
    lineHeight: 31,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: theme.font,
    color: '#4A5290',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  summary: {
    minHeight: 190,
    padding: 16,
    borderWidth: 3,
    borderColor: '#3B4FB8',
    backgroundColor: '#FFFFFF',
    gap: 10,
    boxShadow: '5px 5px 0 #AFC0FF',
  },
  body: {
    fontFamily: theme.font,
    color: '#242565',
    fontSize: 14,
    lineHeight: 21,
  },
  caption: {
    fontFamily: theme.font,
    color: '#4A5290',
    fontSize: 12,
    lineHeight: 20,
  },
  close: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 48,
    height: 48,
    padding: 8,
  },
  closeIcon: { width: 24, height: 24 },
  homePanel: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 12,
    borderWidth: 2,
    borderColor: '#2F3A9E',
  },
  homeText: {
    fontFamily: theme.font,
    color: '#2F3A9E',
    fontSize: 14,
    lineHeight: 22,
  },
  feedback: { gap: 12 },
  error: {
    fontFamily: theme.font,
    color: '#8D254A',
    fontSize: 14,
    lineHeight: 22,
  },
});

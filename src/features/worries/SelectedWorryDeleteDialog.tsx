import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { theme } from '../../ui/theme';
import { PixelPanel } from './PixelPanel';
import type { SelectionSnapshot } from './selectionDeletion';
export function SelectedWorryDeleteDialog({
  count,
  state,
  onConfirm,
  onCancel,
}: {
  count: number;
  state: SelectionSnapshot;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const width = Math.min(300, useWindowDimensions().width - 60),
    buttonWidth = (width - 52) / 2;
  const done = state.items.filter((i) => i.status === 'done').length,
    unknown = state.items.filter((i) => i.status === 'unknown').length,
    failed = state.items.filter((i) => i.status === 'failed').length;
  const label = state.pending
    ? '삭제 확인 중'
    : unknown
      ? '삭제 결과 다시 확인'
      : failed
        ? '미완료 항목 다시 처리'
        : '지울게요';
  const action = (cancel: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={cancel ? '그냥 둘게요' : label}
      accessibilityState={{
        disabled: state.pending,
        busy: !cancel && state.pending,
      }}
      disabled={state.pending}
      onPress={cancel ? onCancel : onConfirm}
    >
      <PixelPanel
        width={buttonWidth}
        originalWidth={124}
        originalHeight={48}
        source={
          cancel
            ? require('../../../assets/images/worry-selection/cancel.svg')
            : require('../../../assets/images/worry-selection/delete.svg')
        }
        shadow={
          cancel
            ? require('../../../assets/images/worry-selection/cancel-shadow.svg')
            : require('../../../assets/images/worry-selection/delete-shadow.svg')
        }
        style={styles.button}
      >
        <Text style={[styles.action, cancel ? styles.cancel : styles.remove]}>
          {cancel ? '그냥 둘게요' : label}
        </Text>
      </PixelPanel>
    </Pressable>
  );
  return (
    <Modal
      transparent
      visible
      animationType="none"
      onRequestClose={() => {
        if (!state.pending) onCancel();
      }}
      statusBarTranslucent
      navigationBarTranslucent
      testID="worry-selection-modal"
    >
      <SafeAreaView style={styles.shade}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <PixelPanel
            width={width}
            originalWidth={300}
            originalHeight={232}
            source={require('../../../assets/images/worry-selection/panel.svg')}
            glow
            style={styles.panel}
          >
            <Image
              source={require('../../../assets/images/worry-selection/sheep.svg')}
              style={{ width: 48.0001, height: 40, alignSelf: 'center' }}
              contentFit="contain"
              accessible={false}
            />
            <Text
              accessibilityRole="header"
              style={styles.title}
            >{`선택한 고민 ${count}개와 돌아보기 답을 지울까요?`}</Text>
            {state.pending && (
              <View style={styles.status}>
                <ActivityIndicator color="#D6A8FF" />
                <Text
                  style={styles.statusText}
                  accessibilityLiveRegion="polite"
                >
                  삭제 결과를 확인하고 있어요.
                </Text>
              </View>
            )}
            {!state.pending && (unknown > 0 || failed > 0) && (
              <Text
                accessibilityRole="alert"
                style={styles.statusText}
              >{`삭제 완료 ${done}개 · 미완료 ${failed}개 · 확인 필요 ${unknown}개`}</Text>
            )}
            <View style={styles.actions}>
              {action(false)}
              {action(true)}
            </View>
          </PixelPanel>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  shade: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 30,
  },
  panel: { paddingHorizontal: 20, paddingTop: 26, paddingBottom: 24, gap: 14 },
  title: {
    fontFamily: theme.font,
    color: '#EEF0FF',
    fontSize: 18,
    lineHeight: 26.1,
    fontWeight: '700',
    textAlign: 'center',
  },
  actions: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 12,
  },
  action: {
    fontFamily: theme.font,
    fontSize: 15,
    lineHeight: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  cancel: { color: '#242565' },
  remove: { color: '#FF9AAE' },
  status: { gap: 8 },
  statusText: {
    fontFamily: theme.font,
    fontSize: 13,
    lineHeight: 21,
    color: '#EEF0FF',
    textAlign: 'center',
  },
});

import { Image } from 'expo-image';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../ui/Button';
import { Notice } from '../../../ui/Notice';
import { theme } from '../../../ui/theme';
import type { useEntrustPause } from './useEntrustPause';
export function EntrustPanel({
  worry,
  flow,
  disabled = false,
}: {
  worry: string;
  flow: ReturnType<typeof useEntrustPause>;
  disabled?: boolean;
}) {
  return (
    <View style={styles.content}>
      <View style={styles.prompt}>
        <Image
          source={require('../../../../assets/images/entrust/sheep.svg')}
          style={styles.sheep}
          contentFit="contain"
          accessible={false}
        />
        <View style={styles.bubble}>
          <Text style={styles.message}>
            {worry
              ? '처음 적은 걱정, 오늘 밤은 내가 들고 있을까요?'
              : '고민 기록을 지웠어요. 이 양은 넘겨 볼까요?'}
          </Text>
        </View>
      </View>
      {flow.busy ? (
        <View style={styles.status} accessibilityLiveRegion="polite">
          <ActivityIndicator color="#EEF0FF" />
          <Text style={styles.message}>
            {flow.phase === 'saving'
              ? '선택을 확인하고 있어요'
              : '맡기기 기록을 불러오고 있어요'}
          </Text>
        </View>
      ) : flow.phase === 'error' ? (
        <View style={styles.status}>
          <Notice
            error
            title="선택 결과를 확인하지 못했어요"
            description="다음 양으로 가기 전에 다시 확인해 주세요. 선택한 내용은 바꾸지 않아요."
          />
          <Button label="선택 다시 시도" onPress={() => void flow.retry()} />
        </View>
      ) : flow.phase === 'closed' ? (
        <Notice
          title="이 밤은 마감됐어요"
          description="진행을 멈추고 홈에서 아침 기록을 확인해 주세요."
        />
      ) : flow.action !== null ? (
        <Notice
          title={
            flow.action === 'entrusted'
              ? '잘 받았어요. 오늘 밤은 내가 들고 있을게요.'
              : '이 걱정은 넘겼어요.'
          }
          description="이 밤의 선택은 그대로 남겨 둘게요."
        />
      ) : null}
      <View style={styles.paper}>
        <View style={styles.fold} />
        <Text accessibilityRole="header" style={styles.paperLabel}>
          처음 적은 걱정
        </Text>
        <Text selectable style={[styles.worry, theme.contentText]}>
          {worry || '남아 있는 고민 기록이 없어요.'}
        </Text>
      </View>
      <Text style={styles.privacy}>
        {worry
          ? '새로 적지 않아도 괜찮아요. 처음 적은 걱정을 그대로 맡겨요.'
          : '기록을 지운 고민은 다시 표시하지 않아요.'}
      </Text>
      {flow.phase === 'ready' && flow.action === null && (
        <View style={styles.actions}>
          {!!worry && (
            <Button
              label="맡기기"
              disabled={disabled}
              onPress={() => void flow.choose('entrusted')}
            />
          )}
          <Button
            label="그냥 넘기기"
            disabled={disabled}
            onPress={() => void flow.choose('skipped')}
          />
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  content: { gap: 20, paddingVertical: 12 },
  prompt: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  sheep: { width: 42, height: 35 },
  bubble: {
    flex: 1,
    backgroundColor: '#3B4FB8',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 4,
  },
  message: {
    fontFamily: theme.font,
    fontSize: 16,
    lineHeight: 24,
    color: '#EEF0FF',
    flexShrink: 1,
  },
  status: { gap: 12 },
  paper: {
    minHeight: 150,
    backgroundColor: '#FFF4D6',
    padding: 16,
    paddingTop: 20,
    boxShadow: '4px 4px 0 #0E1040',
    gap: 12,
  },
  fold: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 16,
    height: 16,
    backgroundColor: '#E8D9B0',
  },
  paperLabel: {
    fontFamily: theme.font,
    fontSize: 14,
    lineHeight: 21,
    color: '#4A5290',
  },
  worry: {
    fontFamily: theme.font,
    fontSize: 18,
    lineHeight: 33,
    color: '#242565',
  },
  privacy: {
    fontFamily: theme.font,
    fontSize: 16,
    lineHeight: 24,
    color: '#CBD0FF',
    textAlign: 'center',
  },
  actions: { gap: 12 },
});

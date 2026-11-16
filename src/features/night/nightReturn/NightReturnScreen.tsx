import { useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NightScreen } from '../../../ui/NightScreen';
import { Button } from '../../../ui/Button';
import { Notice } from '../../../ui/Notice';
import { theme } from '../../../ui/theme';
import { returnRecordKey, type NightReturnRecord } from './model';
import { NightReturnArtwork } from './NightReturnArtwork';
import { ReturnRecordCard } from './ReturnRecord';
import { ReturnCountPicker, type RestartCount } from './ReturnCountPicker';
interface Props {
  record: NightReturnRecord;
  onRestart: (count: RestartCount) => void;
  onRest: () => void;
  pending?: boolean;
  error?: boolean;
  onRetry?: () => void;
}
export function NightReturnScreen(props: Props) {
  return <Session key={returnRecordKey(props.record)} {...props} />;
}
function Session({
  record,
  onRestart,
  onRest,
  pending = false,
  error = false,
  onRetry,
}: Props) {
  const [count, setCount] = useState<RestartCount>(5);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onRest();
      return true;
    });
    return () => sub.remove();
  }, [onRest]);
  return (
    <NightScreen
      background={require('../../../../assets/images/night-return/background.svg')}
    >
      <ScrollView ref={scroll} contentContainerStyle={styles.content}>
        <NightReturnArtwork />
        <Text style={styles.title} accessibilityRole="header">
          다시 깼구나, 괜찮아요
        </Text>
        <Text style={styles.description}>
          {record.summary.entrusted_count > 0
            ? '아까 맡긴 걱정은 양들이 잘 들고 자고 있어요.'
            : '아까 센 양들이 잘 쉬고 있어요.'}
          {'\n'}조금만 더 세어 볼까요?
        </Text>
        <ReturnRecordCard record={record} />
        <ReturnCountPicker
          value={count}
          disabled={pending || error}
          onChange={setCount}
        />
        <View style={styles.spacer} />
        {error && (
          <View
            onLayout={() => scroll.current?.scrollToEnd({ animated: false })}
          >
            <Notice
              error
              title="밤 상태를 확인하지 못했어요"
              description="선택을 유지했어요. 다시 확인한 뒤에 이어 갈게요."
            />
          </View>
        )}
        <Button
          label={
            pending
              ? '밤 상태 확인 중'
              : error
                ? '다시 확인'
                : `${count}마리 더 세기`
          }
          busy={pending}
          onPress={() => {
            if (error) onRetry?.();
            else if (!pending) onRestart(count);
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="그냥 누워 있을게요"
          onPress={onRest}
          style={styles.secondary}
        >
          <Text style={styles.secondaryLabel}>그냥 누워 있을게요</Text>
        </Pressable>
      </ScrollView>
    </NightScreen>
  );
}
const styles = StyleSheet.create({
  content: { flexGrow: 1, gap: 14, padding: 20, paddingBottom: 24 },
  title: {
    fontFamily: theme.font,
    fontSize: 22,
    lineHeight: 31,
    fontWeight: '700',
    color: theme.color.text,
    textAlign: 'center',
  },
  description: {
    fontFamily: theme.font,
    fontSize: 14,
    lineHeight: 21,
    color: theme.color.muted,
    textAlign: 'center',
  },
  spacer: { flexGrow: 1 },
  secondary: {
    minHeight: 52,
    padding: 12,
    borderWidth: 1,
    borderColor: '#4A5BC2',
    backgroundColor: '#1E2063',
    borderRadius: theme.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    fontFamily: theme.font,
    fontSize: 15,
    lineHeight: 22,
    color: theme.color.text,
    fontWeight: '700',
    textAlign: 'center',
  },
});

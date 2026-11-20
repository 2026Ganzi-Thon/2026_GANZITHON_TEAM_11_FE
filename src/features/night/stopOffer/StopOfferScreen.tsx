import { useEffect } from 'react';
import { Image } from 'expo-image';
import {
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Button } from '../../../ui/Button';
import { NightScreen } from '../../../ui/NightScreen';
import { theme } from '../../../ui/theme';
import { stopOfferPosition } from './model';
export function StopOfferScreen({
  sheepCount,
  onStop,
  onContinue,
  onBack,
}: {
  sheepCount: number;
  onStop: () => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const position = stopOfferPosition(sheepCount);
  const { fontScale } = useWindowDimensions();
  useEffect(() => {
    if (position === null) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack, position]);
  if (position === null) return null;
  return (
    <NightScreen
      background={require('../../../../assets/images/stop-offer/background.svg')}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.header, fontScale > 1.3 && styles.largeHeader]}>
          <Text style={styles.progress}>
            {position} / {sheepCount}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="그만 세고 싶어요"
            onPress={onStop}
            style={styles.leave}
          >
            <Text style={styles.leaveLabel}>그만 세고 싶어요</Text>
          </Pressable>
        </View>
        <StopOfferPanel onStop={onStop} onContinue={onContinue} />
      </ScrollView>
    </NightScreen>
  );
}
export function StopOfferPanel({
  onStop,
  onContinue,
  disabled = false,
}: {
  onStop: () => void;
  onContinue: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.panel}>
      <View style={styles.artwork}>
        <Image
          source={require('../../../../assets/images/stop-offer/yawning-sheep.svg')}
          style={styles.yawning}
          contentFit="contain"
          accessible={false}
        />
      </View>
      <View style={styles.prompt}>
        <Image
          source={require('../../../../assets/images/stop-offer/sheep.svg')}
          style={styles.guide}
          contentFit="contain"
          accessible={false}
        />
        <View style={styles.bubble}>
          <Text style={styles.message}>
            눈이 좀 무거워졌다면, 여기서 그만 세도 괜찮아.
          </Text>
        </View>
      </View>
      <View style={styles.spacer} />
      <Button label="그만 셀래요" onPress={onStop} disabled={disabled} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="계속 셀래요"
        disabled={disabled}
        accessibilityState={{ disabled }}
        onPress={onContinue}
        style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
      >
        <Text style={styles.secondaryLabel}>계속 셀래요</Text>
      </Pressable>
      <Text style={styles.caption}>
        그만 세면 따뜻한 카드 한 장으로 마무리해요
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  panel: { flexGrow: 1, gap: 14, width: '100%' },
  content: { flexGrow: 1, padding: 20, paddingBottom: 24, gap: 14 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 32,
  },
  largeHeader: { flexDirection: 'column', alignItems: 'flex-start', gap: 6 },
  progress: {
    fontFamily: theme.font,
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 27,
    color: theme.color.text,
  },
  leave: { minHeight: 48, justifyContent: 'center' },
  leaveLabel: {
    fontFamily: theme.font,
    fontSize: 16,
    lineHeight: 24,
    color: '#8F98D6',
  },
  artwork: { height: 220, alignItems: 'center', justifyContent: 'center' },
  yawning: { width: 178, height: 151 },
  prompt: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  guide: { width: 42, height: 35 },
  bubble: {
    flex: 1,
    backgroundColor: '#3346AE',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: theme.radius,
  },
  message: {
    fontFamily: theme.font,
    fontSize: 16,
    lineHeight: 24,
    color: theme.color.text,
  },
  spacer: { flexGrow: 1 },
  secondary: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: '#4A5BC2',
    backgroundColor: '#1E2063',
  },
  secondaryLabel: {
    fontFamily: theme.font,
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 27,
    color: theme.color.text,
    textAlign: 'center',
  },
  pressed: { opacity: 0.65 },
  caption: {
    fontFamily: theme.font,
    fontSize: 14,
    lineHeight: 21,
    color: theme.color.muted,
  },
});

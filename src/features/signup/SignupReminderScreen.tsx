import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type ComponentRef,
} from 'react';
import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NightScreen } from '../../ui/NightScreen';
import { Button } from '../../ui/Button';
import { theme } from '../../ui/theme';
import { TimeWheel } from '../reminder/TimeWheel';
import { parseLocalTime } from '../reminder/time';
import { SignupShell, signupStyles } from './SignupShell';
import type { SignupOnboarding } from './onboarding';
export function displayReminderTime(value: string) {
  const parts = parseLocalTime(value)!;
  return `${parts.period ? '오후' : '오전'} ${parts.hour}:${String(parts.minute).padStart(2, '0')}`;
}
export function SignupReminderScreen({ c }: { c: SignupOnboarding }) {
  const state = useSyncExternalStore(c.subscribe, c.getSnapshot, c.getSnapshot),
    device = useSyncExternalStore(
      c.reminder.device.subscribe,
      c.reminder.device.getSnapshot,
      c.reminder.device.getSnapshot,
    );
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const feedback = state.busy || !!state.error;
  useEffect(() => {
    if (!feedback) return;
    const frame = requestAnimationFrame(() =>
      scroll.current?.scrollToEnd({ animated: false }),
    );
    return () => cancelAnimationFrame(frame);
  }, [feedback]);
  if (state.stage === 'time')
    return (
      <SignupShell
        title="알림 시간"
        onBack={c.back}
        background={require('../../../assets/images/signup-reminder/background.svg')}
        label="이 시간으로 정하기"
        onSubmit={c.confirmTime}
      >
        <Text style={signupStyles.title}>{'몇 시에\n불러 드릴까요?'}</Text>
        <Text style={signupStyles.body}>설정에서 언제든 바꿀 수 있어요</Text>
        <View style={{ marginTop: 16 }}>
          <TimeWheel
            value={state.draftTime}
            disabled={false}
            onChange={c.changeTime}
          />
        </View>
        <Text style={signupStyles.caption}>
          잠자리에 들기 30분 전쯤을 추천해요!
        </Text>
      </SignupShell>
    );
  const label = state.busy
    ? state.progress
    : state.retry === 'clock'
      ? '현재 시간 다시 확인'
      : state.retry === 'device'
        ? '기기 알림 다시 확인'
        : state.retry === 'skip'
          ? '알림 끄기 다시 확인'
          : '알림 허용';
  const canOpenSettings =
    device.permission?.canAskAgain === false ||
    device.permission?.channel === 'blocked';
  return (
    <NightScreen
      background={require('../../../assets/images/signup-reminder/background.svg')}
    >
      <ScrollView
        ref={scroll}
        contentContainerStyle={s.content}
        onContentSizeChange={() => {
          if (feedback) scroll.current?.scrollToEnd({ animated: false });
        }}
      >
        <View style={s.hero}>
          <Image
            source={require('../../../assets/images/signup-reminder/bell.svg')}
            style={s.bell}
            contentFit="contain"
            accessible={false}
          />
          <Text accessibilityRole="header" style={s.title}>
            {'밤이 오면\n알려 드려도 될까요?'}
          </Text>
          <Text style={s.body}>양 셀 시간에 맞춰 알려 드릴게요</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`알림 받을 시간, ${displayReminderTime(state.localTime)}`}
            disabled={state.busy || state.retry === 'clock'}
            accessibilityState={{
              disabled: state.busy || state.retry === 'clock',
            }}
            onPress={c.openTime}
            style={s.time}
          >
            <Text style={s.timeLabel}>알림 받을 시간</Text>
            <Text style={s.timeValue}>
              {displayReminderTime(state.localTime)} ›
            </Text>
          </Pressable>
        </View>
        <View style={s.space} />
        <View style={s.footer}>
          {!!state.error && (
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={s.error}
            >
              {state.error}
            </Text>
          )}
          <Button
            label={label}
            onPress={state.retry ? c.retry : c.allow}
            busy={state.busy}
          />
          {canOpenSettings && state.retry !== 'clock' && (
            <Secondary
              label="기기 설정 열기"
              onPress={c.openSettings}
              disabled={state.busy}
            />
          )}
          {state.retry !== 'clock' && (
            <Secondary
              label={state.error ? '알림 없이 계속하기' : '나중에 할게요'}
              onPress={c.skip}
              disabled={state.busy}
            />
          )}
        </View>
      </ScrollView>
    </NightScreen>
  );
}
function Secondary({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[s.secondary, disabled && { opacity: 0.65 }]}
    >
      <Text style={s.secondaryText}>{label}</Text>
    </Pressable>
  );
}
const s = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    gap: 14,
  },
  hero: { flexGrow: 1, justifyContent: 'center', gap: 14, minHeight: 350 },
  bell: { width: 150, height: 90, alignSelf: 'center', marginBottom: 14 },
  title: {
    fontFamily: theme.font,
    fontSize: 24,
    lineHeight: 34,
    fontWeight: '700',
    color: theme.color.text,
    textAlign: 'center',
  },
  body: {
    fontFamily: theme.font,
    fontSize: 14,
    lineHeight: 21,
    color: theme.color.muted,
    textAlign: 'center',
  },
  time: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#4A5BC2',
    marginTop: 6,
  },
  timeLabel: {
    fontFamily: theme.font,
    fontSize: 15,
    lineHeight: 23,
    color: theme.color.text,
  },
  timeValue: {
    fontFamily: theme.font,
    fontSize: 14,
    lineHeight: 22,
    color: '#C5CDFF',
  },
  space: { minHeight: 30, flex: 0.4 },
  footer: { gap: 14 },
  error: {
    fontFamily: theme.font,
    fontSize: 13,
    lineHeight: 21,
    color: theme.color.error,
    backgroundColor: '#1E2063',
    padding: 12,
    borderRadius: 4,
  },
  secondary: {
    backgroundColor: '#1E2063',
    borderWidth: 1,
    borderColor: '#4A5BC2',
    minHeight: 52,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
  },
  secondaryText: {
    fontFamily: theme.font,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    color: theme.color.text,
    textAlign: 'center',
  },
});

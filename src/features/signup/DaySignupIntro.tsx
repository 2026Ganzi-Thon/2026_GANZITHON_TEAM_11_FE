import { useSyncExternalStore } from 'react';
import { Image } from 'expo-image';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { NightScreen } from '../../ui/NightScreen';
import { Button } from '../../ui/Button';
import { theme } from '../../ui/theme';
import type { SignupOnboarding } from './onboarding';
import { displayReminderTime } from './SignupReminderScreen';
export function DaySignupIntro({ c }: { c: SignupOnboarding }) {
  const state = useSyncExternalStore(c.subscribe, c.getSnapshot, c.getSnapshot),
    device = useSyncExternalStore(
      c.reminder.device.subscribe,
      c.reminder.device.getSnapshot,
      c.reminder.device.getSnapshot,
    );
  const confirmed =
    state.intent === 'allow' &&
    device.phase === 'ready' &&
    device.state?.state === 'scheduled' &&
    device.state.localTime === state.localTime;
  return (
    <NightScreen
      background={require('../../../assets/images/signup-reminder/background.svg')}
    >
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.spacer} />
        <View style={s.hero}>
          <Text accessibilityRole="header" style={s.title}>
            {'지금은 양들이\n자는 시간이에요'}
          </Text>
          <View style={s.sheep}>
            <Image
              source={require('../../../assets/images/signup-reminder/sheep.png')}
              style={{ width: 78, height: 65 }}
              accessible={false}
              contentFit="contain"
            />
            <Image
              source={require('../../../assets/images/signup-reminder/sheep-small.png')}
              style={{ width: 60, height: 50 }}
              accessible={false}
              contentFit="contain"
            />
            <Image
              source={require('../../../assets/images/signup-reminder/sheep-raised.png')}
              style={{ width: 60, height: 50, marginBottom: 10 }}
              accessible={false}
              contentFit="contain"
            />
          </View>
          <Text style={s.body}>밤 9시부터 새벽 4시까지 양을 셀 수 있어요!</Text>
          <View style={s.pill}>
            {confirmed && (
              <Image
                source={require('../../../assets/images/signup-reminder/bell.svg')}
                style={{ width: 30, height: 18 }}
                contentFit="contain"
                accessible={false}
              />
            )}
            <Text style={[s.body, confirmed && s.confirmed]}>
              {confirmed
                ? `${displayReminderTime(state.localTime)}에 알려 드릴게요`
                : '밤 9시가 되면 다시 들러 주세요'}
            </Text>
          </View>
        </View>
        <View style={s.spacer} />
        <Button label="밤에 만나요" onPress={c.acknowledge} />
      </ScrollView>
    </NightScreen>
  );
}
const s = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: 20, paddingVertical: 24, gap: 14 },
  spacer: { flex: 1, minHeight: 50 },
  hero: { gap: 22, alignItems: 'center' },
  title: {
    fontFamily: theme.font,
    fontSize: 24,
    lineHeight: 34,
    fontWeight: '700',
    color: theme.color.text,
    textAlign: 'center',
    letterSpacing: 1.5,
  },
  sheep: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-end',
    paddingVertical: 10,
  },
  body: {
    fontFamily: theme.font,
    fontSize: 14,
    lineHeight: 21,
    color: theme.color.muted,
    textAlign: 'center',
    flexShrink: 1,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(238,240,255,0.08)',
    borderColor: 'rgba(195,201,240,0.35)',
    borderWidth: 1,
    borderRadius: 999,
    maxWidth: '100%',
  },
  confirmed: { fontWeight: '700', color: theme.color.text },
});

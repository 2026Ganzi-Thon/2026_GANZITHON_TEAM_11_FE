import { useMemo, useState, useSyncExternalStore } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { Redirect, router } from 'expo-router';
import { getNativeReminderSession } from '../../notifications/nativeRuntime';
import { MorningScreen } from '../../features/morning/MorningScreen';
import { NightScreen } from '../../ui/NightScreen';
import { Notice } from '../../ui/Notice';
import { Button } from '../../ui/Button';
import { theme } from '../../ui/theme';
export default function NativeReminderPreview() {
  const session = useMemo(
    () => (__DEV__ ? getNativeReminderSession() : null),
    [],
  );
  if (!__DEV__ || !session) return <Redirect href="/" />;
  return <Session session={session} />;
}
function Session({
  session,
}: {
  session: ReturnType<typeof getNativeReminderSession>;
}) {
  const [home, setHome] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState<string | null>(null);
  const snapshot = useSyncExternalStore(
    session.device.subscribe,
    session.device.getSnapshot,
  );
  if (home)
    return (
      <MorningScreen
        actions={session.source}
        loadDetail={session.source.loadSheep}
        onExit={() => setHome(false)}
      />
    );
  async function reset() {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      await session.reset();
      setNotice('기기 예약을 껐어요.');
    } catch {
      setNotice('예약 취소를 확인하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  }
  async function test() {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      await session.sendTest();
      setNotice('테스트 알림을 보냈어요. 알림 창을 확인해 주세요.');
    } catch {
      setNotice(
        '테스트 알림을 보내지 못했어요. 권한과 기기 설정을 확인해 주세요.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <NightScreen>
      <ScrollView contentContainerStyle={styles.content}>
        <Notice
          title="Android 알림 연결"
          description="계정 설정은 mock이며 권한 요청과 기기 예약은 실제예요. 아침 홈의 설정에서 알림을 변경해 주세요. 앱 재실행 시 mock이 꺼짐으로 초기화되어 이전 예약도 정리해요."
        />
        <Text style={styles.text}>
          기기 상태 ·{' '}
          {snapshot.phase === 'checking'
            ? '확인 중'
            : snapshot.phase === 'error'
              ? '확인 필요'
              : snapshot.state?.state === 'scheduled'
                ? `매일 ${snapshot.state.localTime}`
                : snapshot.state?.state === 'off'
                  ? '예약 없음'
                  : snapshot.state?.state === 'time-zone-required'
                    ? '한국 시간 필요'
                    : '권한 필요'}
        </Text>
        {notice && (
          <Text accessibilityRole="alert" style={styles.text}>
            {notice}
          </Text>
        )}
        <Button
          label="아침 홈 열기"
          disabled={busy}
          onPress={() => setHome(true)}
        />
        <Button
          label="테스트 알림 보내기"
          disabled={
            busy ||
            snapshot.permission?.status !== 'granted' ||
            snapshot.permission?.channel === 'blocked'
          }
          onPress={() => void test()}
        />
        <Button
          label="기기 상태 다시 확인"
          disabled={busy}
          onPress={() => void session.device.refresh()}
        />
        <Button
          label="알림 끄고 시연 끝내기"
          busy={busy}
          onPress={() => void reset()}
        />
        <Button
          label="시작 화면으로"
          disabled={busy}
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace('/')
          }
        />
      </ScrollView>
    </NightScreen>
  );
}
const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 20, gap: 16 },
  text: {
    fontFamily: theme.font,
    color: theme.color.text,
    fontSize: 15,
    lineHeight: 24,
  },
});

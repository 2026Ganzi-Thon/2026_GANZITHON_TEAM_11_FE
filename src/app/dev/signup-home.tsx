import { canUseMock } from '../../config/runtime';
import { useMemo, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { ScrollView } from 'react-native';
import {
  SignupOnboardingFlow,
  type SignupOnboardingSource,
} from '../../features/signup/SignupOnboardingFlow';
import { createMockSignupOnboarding } from '../../mocks/signupOnboarding';
import { getNativeReminderSession } from '../../notifications/nativeRuntime';
import { NightEntryScreen } from '../../features/night/NightEntryScreen';
import { createMockNightEntry } from '../../mocks/nightEntry';
import { createMockNightFeed } from '../../mocks/nightFeed';
import { createMockNightClosing } from '../../mocks/nightClosing';
import { NightScreen } from '../../ui/NightScreen';
import { Notice } from '../../ui/Notice';
import { Button } from '../../ui/Button';
export default function SignupHomePreview() {
  const runtime = useMemo(
    () => (canUseMock() ? getNativeReminderSession() : null),
    [],
  );
  const [source, setSource] = useState<SignupOnboardingSource | null>(null),
    [open, setOpen] = useState(false),
    [night, setNight] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const nightSource = useMemo(
    () =>
      source
        ? {
            entry: createMockNightEntry('success'),
            closing: createMockNightClosing(),
          }
        : null,
    [source],
  );
  if (!canUseMock() || !runtime) return <Redirect href="/" />;
  const start = async (phase: 'day' | 'night' | 'slow') => {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      await runtime.reset();
      setSource(createMockSignupOnboarding(runtime.reminder, phase));
      setOpen(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  if (source && open && nightSource)
    return night ? (
      <NightEntryScreen
        actions={nightSource.entry}
        createFeed={createMockNightFeed}
        closingActions={nightSource.closing}
        onBack={() => setNight(false)}
      />
    ) : (
      <SignupOnboardingFlow
        source={source}
        onExit={() => setOpen(false)}
        onNight={() => setNight(true)}
      />
    );
  return (
    <NightScreen>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20, gap: 16 }}>
        <Notice
          title="가입 → 알림 → 첫 홈"
          description="가입·생일·계정 설정·홈 시각은 메모리 mock이며, 기기 알림 권한·예약·취소는 실제 Android 기능입니다. 낮 안내는 같은 시연 계정에서 한 번만 표시합니다. 앱 종료 후 복원과 실제 인증은 연결하지 않았고 정시 배달은 보장하지 않습니다. 밤 입력은 독립 시연입니다."
        />
        {error && (
          <Notice
            title="기기 예약 정리를 확인하지 못했어요"
            description="다시 시도해 주세요."
          />
        )}
        {source && source.onboarding.getSnapshot().stage !== 'signup' && (
          <Button
            label="같은 계정 다시 열기"
            onPress={() => setOpen(true)}
            disabled={busy}
          />
        )}
        <Button
          label="낮 가입부터 시작"
          onPress={() => void start('day')}
          busy={busy}
        />
        <Button
          label="밤 가입부터 시작"
          onPress={() => void start('night')}
          disabled={busy}
        />
        <Button
          label="느린 알림 저장"
          onPress={() => void start('slow')}
          disabled={busy}
        />
        <Button
          label="알림 끄고 시연 끝내기"
          disabled={busy}
          onPress={() => {
            if (busy) return;
            setBusy(true);
            setError(false);
            void runtime
              .reset()
              .then(() => {
                setSource(null);
                setOpen(false);
                setNight(false);
              })
              .catch(() => setError(true))
              .finally(() => setBusy(false));
          }}
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

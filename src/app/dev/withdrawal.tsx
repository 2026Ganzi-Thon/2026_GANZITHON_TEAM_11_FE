import { useMemo, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { ScrollView } from 'react-native';
import { canUseMock } from '../../config/runtime';
import {
  SignupJourneyFlow,
  type SignupJourneySource,
} from '../../features/signup/SignupJourneyFlow';
import { createMockSignupJourney } from '../../mocks/signupJourney';
import { getNativeReminderSession } from '../../notifications/nativeRuntime';
import { NightScreen } from '../../ui/NightScreen';
import { Notice } from '../../ui/Notice';
import { Button } from '../../ui/Button';
export default function WithdrawalPreview() {
  const runtime = useMemo(
    () => (canUseMock() ? getNativeReminderSession() : null),
    [],
  );
  const [source, setSource] = useState<SignupJourneySource | null>(null),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  if (!canUseMock() || !runtime) return <Redirect href="/" />;
  const start = async (withdrawalScenario: 'success' | 'retry' | 'slow') => {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      await runtime.reset();
      const next = createMockSignupJourney(runtime.reminder, 'day', {
        withdrawalScenario,
      });
      next.onboarding.begin(
        { id: 'withdrawal-preview-account', email: 'preview@example.com' },
        { birth_date: '2004-05-14', edits_remaining: 1, zodiac: 'taurus' },
      );
      setSource(next);
      setOpen(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  if (open && source)
    return <SignupJourneyFlow source={source} onExit={() => setOpen(false)} />;
  return (
    <NightScreen>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20, gap: 16 }}>
        <Notice
          title="탈퇴 → 가입 시작"
          description="계정·탈퇴·기록은 메모리 mock이며 실제 서버 데이터는 삭제하지 않아요. 가입 완료된 예시 계정에서 알림 선택 → 홈 → 설정 → 탈퇴를 확인해 보세요. 기기 알림 권한·예약·취소는 실제로 동작하며, 알림 OFF 확인 후 빈 가입 시작 화면으로 돌아와요. 앱 종료 후 복원은 지원하지 않아요."
        />
        {error && (
          <Notice
            title="기기 예약 정리를 확인하지 못했어요"
            description="다시 시도해 주세요."
          />
        )}
        {source && source.onboarding.getSnapshot().stage !== 'signup' && (
          <Button
            label="같은 예시 계정 다시 열기"
            disabled={busy}
            onPress={() => setOpen(true)}
          />
        )}
        <Button
          label="탈퇴·새 가입 확인"
          busy={busy}
          onPress={() => void start('success')}
        />
        <Button
          label="탈퇴 실패 후 재시도"
          disabled={busy}
          onPress={() => void start('retry')}
        />
        <Button
          label="느린 탈퇴"
          disabled={busy}
          onPress={() => void start('slow')}
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

import { useEffect, useMemo, useRef, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { ScrollView } from 'react-native';
import { canUseMock } from '../../config/runtime';
import { getNativeReminderSession } from '../../notifications/nativeRuntime';
import { createMockSignupJourney } from '../../mocks/signupJourney';
import { prepareReceivedYarnMorning } from '../../mocks/receivedYarnHomePreview';
import type { ReceivedYarnScenario } from '../../mocks/receivedYarn';
import {
  SignupJourneyFlow,
  type SignupJourneySource,
} from '../../features/signup/SignupJourneyFlow';
import { Button } from '../../ui/Button';
import { Notice } from '../../ui/Notice';
import { NightScreen } from '../../ui/NightScreen';
export default function ReceivedYarnHomePreview() {
  const runtime = useMemo(
    () => (canUseMock() ? getNativeReminderSession() : null),
    [],
  );
  const [source, setSource] = useState<SignupJourneySource | null>(null),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const active = useRef<AbortController | null>(null),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      active.current?.abort();
    };
  }, []);
  if (!canUseMock() || !runtime) return <Redirect href="/" />;
  const run = async (job: (signal: AbortSignal) => Promise<void>) => {
    if (active.current) return;
    const c = new AbortController();
    active.current = c;
    setBusy(true);
    setError(false);
    try {
      await job(c.signal);
    } catch {
      if (alive.current && !c.signal.aborted) setError(true);
    } finally {
      if (active.current === c) active.current = null;
      if (alive.current && !c.signal.aborted) setBusy(false);
    }
  };
  const start = (scenario: ReceivedYarnScenario, amount: 0 | 3 = 3) =>
    void run(async (signal) => {
      await runtime.reset();
      if (signal.aborted) return;
      const next = createMockSignupJourney(runtime.reminder, 'night', {
        receivedYarnScenario: scenario,
      });
      await prepareReceivedYarnMorning(next, signal, amount);
      if (alive.current && !signal.aborted) {
        setSource(next);
        setOpen(true);
      }
    });
  if (open && source)
    return <SignupJourneyFlow source={source} onExit={() => setOpen(false)} />;
  const registered = source?.onboarding.getSnapshot().stage === 'home';
  return (
    <NightScreen>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20, gap: 16 }}>
        <Notice
          title="받은 털실 → 같은 계정 아침 홈"
          description="가입된 예시 계정의 공개 글 카드 2장과 수신 이벤트로 확인해요. 실제 다른 사용자·서버·푸시와 연결하지 않아요. 04시 기준 첫 일반 아침 홈에서 표시하고 종으로 다시 열 수 있어요. 내 카드 수와 수신 예시는 같은 기록을 사용하며, 시연 종료·앱 재실행 시 초기화돼요."
        />
        {error && (
          <Notice
            title="시연 준비를 완료하지 못했어요"
            description="새 시연으로 다시 시작해 주세요."
          />
        )}
        {registered && (
          <>
            <Button
              label="같은 아침 홈 다시 열기"
              disabled={busy}
              onPress={() => setOpen(true)}
            />
            <Button
              label="같은 계정 다음 아침 · 털실 1개"
              busy={busy}
              onPress={() =>
                void run(async (signal) => {
                  await prepareReceivedYarnMorning(source!, signal, 1);
                  if (alive.current && !signal.aborted) setOpen(true);
                })
              }
            />
          </>
        )}
        <Button
          label="아침 홈 · 받은 털실 3개"
          disabled={busy}
          onPress={() => start('success')}
        />
        <Button
          label="받은 털실 없는 아침"
          disabled={busy}
          onPress={() => start('success', 0)}
        />
        <Button
          label="받은 털실 조회 재시도"
          disabled={busy}
          onPress={() => start('load-retry')}
        />
        <Button
          label="읽음 저장 재시도"
          disabled={busy}
          onPress={() => start('seen-retry')}
        />
        <Button
          label="읽음 응답 유실"
          disabled={busy}
          onPress={() => start('seen-lost')}
        />
        <Button
          label="느린 받은 털실 조회"
          disabled={busy}
          onPress={() => start('slow-load')}
        />
        <Button
          label="느린 읽음 저장"
          disabled={busy}
          onPress={() => start('slow-seen')}
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

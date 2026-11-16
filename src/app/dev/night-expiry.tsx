import { useEffect, useRef, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { ScrollView } from 'react-native';
import { canUseMock } from '../../config/runtime';
import { HomeNightJourney } from '../../features/home/HomeNightJourney';
import {
  createNightExpiryPreview,
  type ExpiryPreviewScenario,
} from '../../mocks/nightExpiryPreview';
import { NightScreen } from '../../ui/NightScreen';
import { Notice } from '../../ui/Notice';
import { Button } from '../../ui/Button';
export default function NightExpiryPreview() {
  const [source, setSource] = useState<Awaited<
    ReturnType<typeof createNightExpiryPreview>
  > | null>(null);
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  if (!canUseMock()) return <Redirect href="/" />;
  const start = async (scenario: ExpiryPreviewScenario) => {
    if (busy) return;
    const request = new AbortController();
    pending.current?.abort();
    pending.current = request;
    setBusy(true);
    setError(false);
    try {
      const value = await createNightExpiryPreview(scenario, request.signal);
      if (!request.signal.aborted) {
        setSource(value);
        setOpen(true);
      }
    } catch {
      if (!request.signal.aborted) setError(true);
    } finally {
      if (!request.signal.aborted) {
        pending.current = null;
        setBusy(false);
      }
    }
  };
  if (source && open)
    return (
      <HomeNightJourney
        source={source}
        initialNightOpen
        onExit={() => setOpen(false)}
      />
    );
  return (
    <NightScreen>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, flexGrow: 1 }}>
        <Notice
          title="04시 마감 · 아침 전환"
          description="각 시연은 준비가 끝난 뒤 약 30초 후 마감돼요. 서버 시각·마감과 기록은 메모리 mock입니다. 확인된 열람만 아침 후보에 남기고 앱 종료 후 복원은 지원하지 않아요."
        />
        {error && (
          <Notice
            error
            title="시연을 준비하지 못했어요"
            description="원하는 시연을 다시 선택해 주세요."
          />
        )}
        {source && (
          <Button
            label="같은 기록 다시 열기"
            disabled={busy}
            onPress={() => setOpen(true)}
          />
        )}
        <Button
          label="일부 세고 마감"
          busy={busy}
          onPress={() => void start('partial')}
        />
        <Button
          label="첫 카드 보기 전 마감"
          disabled={busy}
          onPress={() => void start('unseen')}
        />
        <Button
          label="시간 확인 실패·재시도"
          disabled={busy}
          onPress={() => void start('check-retry')}
        />
        <Button
          label="아침 조회 실패·재시도"
          disabled={busy}
          onPress={() => void start('morning-retry')}
        />
        <Button
          label="카드 작성 중 마감"
          disabled={busy}
          onPress={() => void start('writing')}
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

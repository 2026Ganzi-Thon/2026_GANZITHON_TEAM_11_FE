import { useEffect, useRef, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { ScrollView } from 'react-native';
import { canUseMock } from '../../config/runtime';
import {
  createEntrustPreview,
  type EntrustPreview,
} from '../../mocks/entrustPreview';
import { NightMorningFlow } from '../../features/demo/NightMorningFlow';
import { NightScreen } from '../../ui/NightScreen';
import { Notice } from '../../ui/Notice';
import { Button } from '../../ui/Button';
export default function EntrustPreviewRoute() {
  const [source, setSource] = useState<Awaited<
    ReturnType<typeof createEntrustPreview>
  > | null>(null);
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  if (!canUseMock()) return <Redirect href="/" />;
  const start = async (preset: EntrustPreview) => {
    if (request.current) return;
    const c = new AbortController();
    request.current = c;
    setBusy(true);
    setError(false);
    try {
      const value = await createEntrustPreview(preset, c.signal);
      if (!c.signal.aborted) {
        setSource(value);
        setOpen(true);
      }
    } catch {
      if (!c.signal.aborted) setError(true);
    } finally {
      if (!c.signal.aborted) {
        request.current = null;
        setBusy(false);
      }
    }
  };
  if (source && open)
    return (
      <NightMorningFlow
        demo={source.demo}
        navigation={source.navigation}
        onExit={() => setOpen(false)}
      />
    );
  return (
    <NightScreen>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, flexGrow: 1 }}>
        <Notice
          title="걱정 맡기기 · 밤부터 아침까지"
          description="7마리 중 4번째 칸에서 시작해요. 처음 적은 고민을 맡기거나 넘긴 뒤 마무리·아침 회고를 확인해요. 계정·기록은 메모리 mock이며 서버 저장·실제 시간 마감·앱 종료 후 복원은 연결하지 않았어요."
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
            label="같은 밤 이어 보기"
            disabled={busy}
            onPress={() => setOpen(true)}
          />
        )}
        <Button
          label="맡기기부터 아침까지"
          busy={busy}
          onPress={() => void start('success')}
        />
        <Button
          label="느린 맡기기 저장"
          disabled={busy}
          onPress={() => void start('slow')}
        />
        <Button
          label="맡기기 실패·재시도"
          disabled={busy}
          onPress={() => void start('retry')}
        />
        <Button
          label="맡기기 응답 유실"
          disabled={busy}
          onPress={() => void start('lost')}
        />
        <Button
          label="긴 고민 맡기기"
          disabled={busy}
          onPress={() => void start('long')}
        />
        <Button
          label="고민 없음 · 맡기기 없음"
          disabled={busy}
          onPress={() => void start('none')}
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

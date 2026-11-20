import { useLiveService } from '../live/ServiceMode';
import { useEffect, useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../ui/Button';
import { theme } from '../../ui/theme';
import type { LogoutActions } from './logout';
interface Props {
  actions: LogoutActions;
  onCancel: () => void;
}
export function LogoutDialog(props: Props) {
  const [source, setSource] = useState({ actions: props.actions, version: 0 });
  if (source.actions !== props.actions)
    setSource({ actions: props.actions, version: source.version + 1 });
  return <Session key={source.version} {...props} />;
}
function Session({ actions, onCancel }: Props) {
  const live = useLiveService();
  const [pending, setPending] = useState(false),
    [error, setError] = useState(false);
  const active = useRef<AbortController | null>(null),
    alive = useRef(true),
    completed = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      active.current?.abort();
    };
  }, []);
  const cancel = () => {
    if (!active.current && !completed.current) onCancel();
  };
  const submit = async () => {
    if (active.current || completed.current || !alive.current) return;
    const request = new AbortController();
    active.current = request;
    setPending(true);
    setError(false);
    try {
      await actions.logout(request.signal);
      if (alive.current && !request.signal.aborted) completed.current = true;
    } catch {
      if (alive.current && !request.signal.aborted) setError(true);
    } finally {
      if (active.current === request) active.current = null;
      if (alive.current && !request.signal.aborted) setPending(false);
    }
  };
  return (
    <Modal
      visible
      transparent
      animationType="none"
      testID="logout-modal"
      onRequestClose={cancel}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <SafeAreaView style={s.shade}>
        <View style={s.panel} accessibilityViewIsModal>
          <ScrollView contentContainerStyle={s.content}>
            <Text accessibilityRole="header" style={s.title}>
              로그아웃할까요?
            </Text>
            <Text style={s.body}>
              양과 확정된 기록은 남아 있어요. 작성 중인 초안은 지워지고, 이
              기기의 알림은 로그아웃 동안 꺼져요.
            </Text>
            <Text style={s.body}>
              {live
                ? '기기의 로그인 정보를 지워요. 다시 로그인하면 저장한 기록을 볼 수 있어요.'
                : '이 체험판에서는 앱을 완전히 종료하면 모든 예시 계정과 기록이 초기화돼요.'}
            </Text>
            <Button label="계속 있을게요" onPress={cancel} disabled={pending} />
            {error && (
              <Text accessibilityRole="alert" style={s.error}>
                로그아웃을 완료하지 못했어요. 계정은 유지했으니 알림 정리와
                로그아웃을 다시 확인해 주세요.
              </Text>
            )}
            <Button
              label={
                pending ? '로그아웃 중' : error ? '다시 로그아웃' : '로그아웃'
              }
              busy={pending}
              onPress={() => void submit()}
            />
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
const s = StyleSheet.create({
  shade: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(14,16,64,0.7)',
  },
  panel: {
    backgroundColor: '#2B3591',
    width: '100%',
    maxWidth: 400,
    maxHeight: '100%',
    alignSelf: 'center',
    flexShrink: 1,
    boxShadow: '5px 5px 0 #0E1040',
  },
  content: { padding: 20, gap: 16 },
  title: {
    fontFamily: theme.font,
    fontSize: 20,
    lineHeight: 30,
    color: theme.color.text,
    fontWeight: '700',
  },
  body: {
    fontFamily: theme.font,
    fontSize: 14,
    lineHeight: 22,
    color: theme.color.muted,
  },
  error: {
    fontFamily: theme.font,
    fontSize: 14,
    lineHeight: 22,
    color: '#F9CFDD',
    backgroundColor: '#1E2063',
    padding: 10,
  },
});

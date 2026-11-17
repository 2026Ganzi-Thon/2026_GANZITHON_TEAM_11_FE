import { type ComponentRef, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../ui/Button';
import { theme } from '../../ui/theme';
import type { WithdrawalActions } from './types';
interface Props {
  actions: WithdrawalActions;
  onCancel: () => void;
  onWithdrawn: () => void;
}
export function WithdrawalDialog(props: Props) {
  const [source, setSource] = useState({ actions: props.actions, version: 0 });
  if (source.actions !== props.actions)
    setSource({ actions: props.actions, version: source.version + 1 });
  return <Session key={source.version} {...props} />;
}
function Session({ actions, onCancel, onWithdrawn }: Props) {
  const [pending, setPending] = useState(false),
    [error, setError] = useState(false);
  const active = useRef<AbortController | null>(null),
    alive = useRef(true),
    completed = useRef(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      active.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!error) return;
    const frame = requestAnimationFrame(() =>
      scroll.current?.scrollToEnd({ animated: false }),
    );
    return () => cancelAnimationFrame(frame);
  }, [error]);
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
      await actions.withdraw(request.signal);
      if (alive.current && !request.signal.aborted) {
        completed.current = true;
        onWithdrawn();
      }
    } catch {
      if (alive.current && !request.signal.aborted) setError(true);
    } finally {
      if (active.current === request) active.current = null;
      if (alive.current && !request.signal.aborted) setPending(false);
    }
  };
  return (
    <Modal
      transparent
      visible
      animationType="none"
      testID="withdrawal-modal"
      onRequestClose={cancel}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <SafeAreaView style={s.shade}>
        <View style={s.panel} accessibilityViewIsModal>
          <Image
            source={require('../../../assets/images/withdrawal/panel.svg')}
            style={StyleSheet.absoluteFill}
            contentFit="fill"
            accessible={false}
            pointerEvents="none"
          />
          <ScrollView
            ref={scroll}
            contentContainerStyle={s.content}
            onContentSizeChange={() => {
              if (error) scroll.current?.scrollToEnd({ animated: false });
            }}
          >
            <View style={s.art}>
              <Image
                source={require('../../../assets/images/withdrawal/sheep.svg')}
                style={{ width: 66.0001, height: 55 }}
                accessible={false}
              />
              <View style={s.tear} />
            </View>
            <Text accessibilityRole="header" style={s.title}>
              정말 떠나나요?
            </Text>
            <Text style={s.body}>
              고민 · 카드 · 양떼 · 털실 모든 정보가 바로 삭제되고 되돌릴 수
              없어요
            </Text>
            {error && (
              <Text accessibilityRole="alert" style={s.error}>
                탈퇴를 완료하지 못했어요. 계정 정리를 다시 확인해 주세요.
              </Text>
            )}
            <View style={s.buttons}>
              <Button
                label="조금 더 있을래요"
                disabled={pending}
                onPress={cancel}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  pending
                    ? '탈퇴 처리 중'
                    : error
                      ? '다시 탈퇴하기'
                      : '탈퇴하기'
                }
                accessibilityState={{ disabled: pending, busy: pending }}
                disabled={pending}
                onPress={() => void submit()}
                style={s.remove}
              >
                {pending && <ActivityIndicator color="#F9CFDD" />}
                <Text style={s.removeText}>
                  {pending
                    ? '탈퇴 처리 중'
                    : error
                      ? '다시 탈퇴하기'
                      : '탈퇴하기'}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="탈퇴 확인 닫기"
            accessibilityState={{ disabled: pending }}
            disabled={pending}
            onPress={cancel}
            style={s.close}
          >
            <Image
              source={require('../../../assets/images/withdrawal/close.svg')}
              style={{ width: 24, height: 24 }}
              accessible={false}
            />
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
const s = StyleSheet.create({
  shade: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingVertical: 16,
    backgroundColor: 'rgba(14,16,64,0.6)',
  },
  panel: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '100%',
    alignSelf: 'center',
    flexShrink: 1,
    boxShadow: '6px 6px 0 #0E1040',
  },
  content: { paddingHorizontal: 24, paddingTop: 34, paddingBottom: 24 },
  art: { alignSelf: 'center', width: 66.0001, height: 55, marginBottom: 16 },
  tear: {
    position: 'absolute',
    left: 51.48,
    top: 34.1,
    width: 3,
    height: 4,
    backgroundColor: '#CFDBFA',
  },
  title: {
    fontFamily: theme.font,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
    color: '#EEF0FF',
    textAlign: 'center',
    marginBottom: 8,
  },
  body: {
    fontFamily: theme.font,
    fontSize: 13,
    lineHeight: 20,
    color: '#C3C9F0',
    textAlign: 'center',
  },
  error: {
    marginTop: 16,
    padding: 10,
    backgroundColor: '#1E2063',
    fontFamily: theme.font,
    fontSize: 13,
    lineHeight: 20,
    color: '#F9CFDD',
  },
  buttons: { gap: 12, marginTop: 22 },
  remove: {
    minHeight: 48,
    padding: 12,
    gap: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2B3591',
    boxShadow: '4px 4px 0 #0E1040',
  },
  removeText: {
    flexShrink: 1,
    fontFamily: theme.font,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '700',
    color: '#F9CFDD',
    textAlign: 'center',
  },
  close: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

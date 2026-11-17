import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentRef,
} from 'react';
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { PasswordResetActions } from './model';
import { usePasswordReset } from './usePasswordReset';
import { ResetArtwork } from './ResetArtwork';
import { NightScreen } from '../../../ui/NightScreen';
import { FormField } from '../../../ui/FormField';
import { Button } from '../../../ui/Button';
import { theme } from '../../../ui/theme';
export interface PasswordResetProps {
  actions: PasswordResetActions;
  initialEmail?: string;
  onLogin: (email: string) => void;
}
export function PasswordResetScreen(props: PasswordResetProps) {
  const [source, setSource] = useState({ actions: props.actions, version: 0 });
  if (source.actions !== props.actions)
    setSource({ actions: props.actions, version: source.version + 1 });
  return <Session key={source.version} {...props} />;
}
function Session({ actions, initialEmail = '', onLogin }: PasswordResetProps) {
  const flow = usePasswordReset(actions, initialEmail, onLogin),
    sent = flow.page === 'sent';
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null),
    feedback = useRef(false),
    frame = useRef<number | null>(null),
    lastPage = useRef(flow.page);
  const cancelScroll = useCallback(() => {
    feedback.current = false;
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
  }, []);
  const reveal = useCallback(() => {
    if (!feedback.current) return;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      if (feedback.current) scroll.current?.scrollToEnd({ animated: false });
    });
  }, []);
  useEffect(() => {
    if (lastPage.current !== flow.page) {
      lastPage.current = flow.page;
      cancelScroll();
      return;
    }
    if (flow.pending || flow.fieldError || flow.error || flow.notice) reveal();
  }, [
    flow.page,
    flow.pending,
    flow.fieldError,
    flow.error,
    flow.notice,
    reveal,
    cancelScroll,
  ]);
  useEffect(() => cancelScroll, [cancelScroll]);
  const back = flow.back;
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      back();
      return true;
    });
    return () => sub.remove();
  }, [back]);
  const send = () => {
    feedback.current = true;
    void flow.send();
  };
  const sendLabel = flow.pending
    ? sent
      ? '메일 다시 요청 중'
      : '메일 요청 중'
    : flow.remaining
      ? `${flow.remaining}초 후 다시 보내기`
      : sent
        ? '메일 다시 보내기'
        : '재설정 메일 보내기';
  return (
    <NightScreen
      background={
        sent
          ? require('../../../../assets/images/password-reset/sent-background.svg')
          : require('../../../../assets/images/text-card/night.svg')
      }
    >
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={s.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="뒤로"
            onPress={flow.back}
            style={s.back}
          >
            <Text style={s.arrow}>←</Text>
          </Pressable>
          {sent && <Text style={s.headerTitle}>비밀번호 찾기</Text>}
        </View>
        <ScrollView
          key={flow.page}
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          onFocusCapture={cancelScroll}
          onTouchStartCapture={cancelScroll}
          onScrollBeginDrag={cancelScroll}
          onContentSizeChange={() => {
            if (flow.pending || flow.error || flow.fieldError || flow.notice)
              reveal();
          }}
          contentContainerStyle={s.content}
        >
          {sent ? (
            <>
              <ResetArtwork />
              <Text
                accessibilityRole="header"
                accessibilityLiveRegion="polite"
                style={s.title}
              >
                메일을 보냈어요
              </Text>
              <Text
                style={s.description}
              >{`${flow.confirmedEmail}이 가입된 주소라면 곧 링크가 도착해요.\n링크에서 새 비밀번호를 정한 뒤 다시 로그인해 주세요.`}</Text>
              <Text style={s.hint}>
                메일이 안 보이면 스팸함도 확인해 주세요!
              </Text>
            </>
          ) : (
            <>
              <Text accessibilityRole="header" style={s.title}>
                비밀번호를 잊었나요?
              </Text>
              <Text style={s.description}>
                이메일로 새 비밀번호를 정하는 링크를 보내 드릴게요
              </Text>
              <View style={s.field}>
                <FormField
                  label="e-mail"
                  accessibilityLabel="이메일 주소"
                  placeholder="이메일 주소"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  returnKeyType="send"
                  value={flow.email}
                  editable={!flow.pending}
                  error={flow.fieldError}
                  onChangeText={flow.edit}
                  onSubmitEditing={send}
                />
              </View>
              <Text style={s.hint}>가입할 때 쓴 이메일 주소를 적어 주세요</Text>
            </>
          )}
          <View style={s.spacer} />
          <View
            style={s.footer}
            onLayout={() => {
              if (flow.pending || flow.error || flow.fieldError || flow.notice)
                reveal();
            }}
          >
            {!!(flow.fieldError || flow.error) && (
              <Text
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                style={s.error}
              >
                {flow.fieldError || flow.error}
              </Text>
            )}
            {!!flow.notice && (
              <Text accessibilityLiveRegion="polite" style={s.description}>
                {flow.notice}
              </Text>
            )}
            {sent && (
              <Button label="로그인으로 돌아가기" onPress={flow.login} />
            )}
            {sent ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={sendLabel}
                accessibilityState={{
                  disabled: flow.pending || flow.remaining > 0,
                  busy: flow.pending,
                }}
                disabled={flow.pending || flow.remaining > 0}
                onPress={send}
                style={s.secondary}
              >
                <Text style={s.secondaryLabel}>{sendLabel}</Text>
              </Pressable>
            ) : (
              <Button
                label={sendLabel}
                busy={flow.pending}
                disabled={flow.remaining > 0}
                onPress={send}
              />
            )}
            <Text style={s.preview}>시연용 · 실제 메일은 발송하지 않아요</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </NightScreen>
  );
}
const s = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  back: { minWidth: 32, minHeight: 48, justifyContent: 'center' },
  arrow: { fontFamily: theme.font, fontSize: 20, color: theme.color.text },
  headerTitle: {
    flex: 1,
    fontFamily: theme.font,
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 24,
    color: theme.color.text,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 14,
  },
  title: {
    fontFamily: theme.font,
    fontSize: 22,
    lineHeight: 30.8,
    fontWeight: '700',
    color: theme.color.text,
  },
  description: {
    fontFamily: theme.font,
    fontSize: 14,
    lineHeight: 21,
    color: theme.color.muted,
  },
  hint: {
    fontFamily: theme.font,
    fontSize: 12,
    lineHeight: 18,
    color: theme.color.muted,
  },
  field: { marginTop: 12 },
  spacer: { flex: 1, minHeight: 24 },
  footer: { gap: 14 },
  error: {
    fontFamily: theme.font,
    fontSize: 14,
    lineHeight: 21,
    color: theme.color.error,
  },
  preview: {
    fontFamily: theme.font,
    fontSize: 10,
    lineHeight: 15,
    color: theme.color.muted,
    textAlign: 'center',
  },
  secondary: {
    minHeight: 52,
    padding: 12,
    backgroundColor: '#1E2063',
    borderWidth: 1,
    borderColor: '#4A5BC2',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    fontFamily: theme.font,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    color: theme.color.text,
  },
});

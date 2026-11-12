import type { LoginRequest } from '../../api/contracts';
import { useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ApiError } from '../../api/errors';
import { Button } from '../../ui/Button';
import { FormField } from '../../ui/FormField';
import { Notice } from '../../ui/Notice';
import { NightScreen } from '../../ui/NightScreen';
import { theme } from '../../ui/theme';

export type LoginSubmit = (
  credentials: LoginRequest,
  signal: AbortSignal,
) => Promise<void>;

export function LoginScreen({
  submit,
  onBack,
}: {
  submit: LoginSubmit;
  onBack: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );
  const [status, setStatus] = useState<
    'idle' | 'pending' | 'success' | 'error'
  >('idle');
  const [message, setMessage] = useState('');
  const [resetNotice, setResetNotice] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      active.current?.abort();
    },
    [],
  );

  const send = async () => {
    if (active.current) return;
    const normalizedEmail = email.trim().toLowerCase();
    const nextErrors = {
      email: !normalizedEmail
        ? '이메일 주소를 입력해 주세요.'
        : normalizedEmail.length > 254 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
          ? '이메일 주소를 확인해 주세요.'
          : undefined,
      password: !password ? '비밀번호를 입력해 주세요.' : undefined,
    };
    setErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) return;
    const controller = new AbortController();
    active.current = controller;
    setStatus('pending');
    setMessage('');
    Keyboard.dismiss();
    try {
      await submit({ email: normalizedEmail, password }, controller.signal);
      if (controller.signal.aborted) return;
      setStatus('success');
      setPassword('');
    } catch (error) {
      if (controller.signal.aborted) return;
      setStatus('error');
      setMessage(
        error instanceof ApiError && error.status === 401
          ? '이메일 또는 비밀번호를 확인해 주세요.'
          : error instanceof ApiError && error.kind === 'timeout'
            ? '응답이 늦어지고 있어요. 다시 시도해 주세요.'
            : '연결하지 못했어요. 잠시 후 다시 시도해 주세요.',
      );
    } finally {
      if (active.current === controller) active.current = null;
    }
  };
  const edit = () => {
    setStatus('idle');
    setMessage('');
    setResetNotice(false);
  };
  const back = () => {
    active.current?.abort();
    onBack();
  };

  return (
    <NightScreen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.topbar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="뒤로"
            onPress={back}
            style={styles.back}
          >
            <Text style={styles.backText}>←</Text>
          </Pressable>
          <Text style={styles.preview}>화면 미리보기 · 실제 로그인 아님</Text>
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <Text accessibilityRole="header" style={styles.title}>
            다시 왔네요
          </Text>
          <Text style={styles.subtitle}>쓰던 양 정보를 그대로 불러올게요</Text>
          <View style={styles.form}>
            <FormField
              label="e-mail"
              accessibilityLabel="이메일 주소"
              placeholder="이메일 주소"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              value={email}
              editable={status !== 'pending'}
              error={errors.email}
              onChangeText={(value) => {
                setEmail(value);
                setErrors((current) => ({ ...current, email: undefined }));
                edit();
              }}
            />
            <FormField
              label="password"
              accessibilityLabel="비밀번호"
              placeholder="비밀번호"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              returnKeyType="go"
              onSubmitEditing={() => {
                void send();
              }}
              value={password}
              editable={status !== 'pending'}
              error={errors.password}
              onChangeText={(value) => {
                setPassword(value);
                setErrors((current) => ({ ...current, password: undefined }));
                edit();
              }}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="비밀번호를 잊었어요"
            onPress={() => setResetNotice(true)}
            style={styles.reset}
          >
            <Image
              source={require('../../../assets/images/question-circle.svg')}
              style={styles.icon}
              accessible={false}
            />
            <Text style={styles.resetText}>비밀번호를 잊었어요</Text>
          </Pressable>
          <View style={styles.messages}>
            {resetNotice && (
              <Notice
                title="비밀번호 찾기는 준비 중이에요."
                description="이 미리보기에서는 재설정 메일을 보내지 않아요."
              />
            )}
            {status === 'error' && <Notice title={message} error />}
            {status === 'success' && (
              <Notice
                title="화면 확인이 완료됐어요"
                description="예시 응답이에요. 계정에 로그인하거나 정보를 저장하지 않았어요."
              />
            )}
          </View>
          <View style={styles.space} />
          <Button
            label={
              status === 'pending'
                ? '확인 중'
                : status === 'error'
                  ? '다시 시도'
                  : '로그인'
            }
            busy={status === 'pending'}
            onPress={() => {
              void send();
            }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </NightScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topbar: {
    minHeight: 52,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  back: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { fontSize: 24, color: theme.color.text },
  preview: {
    fontFamily: theme.font,
    fontSize: 11,
    lineHeight: 17,
    includeFontPadding: false,
    color: theme.color.muted,
    flexShrink: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: theme.gutter,
    paddingTop: 16,
    paddingBottom: 24,
  },
  title: {
    fontFamily: theme.font,
    fontWeight: '700',
    color: theme.color.text,
    fontSize: 30,
    lineHeight: 42,
  },
  subtitle: {
    fontFamily: theme.font,
    color: theme.color.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
  },
  form: { gap: 24, marginTop: 28 },
  reset: {
    minHeight: 44,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'flex-end',
    alignSelf: 'flex-end',
  },
  resetText: {
    fontFamily: theme.font,
    fontSize: 12,
    lineHeight: 18,
    color: theme.color.muted,
  },
  icon: { width: 14, height: 14 },
  messages: { gap: 12, marginTop: 12 },
  space: { flex: 1, minHeight: 32 },
});

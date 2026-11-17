import { canUseMock } from '../../config/runtime';
import { useMemo, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { LoginRecoveryFlow } from '../../features/auth/LoginRecoveryFlow';
import { createMockLogin, type LoginScenario } from '../../mocks/login';
import {
  createMockPasswordReset,
  type PasswordResetScenario,
} from '../../mocks/passwordReset';
import { Button } from '../../ui/Button';
import { NightScreen } from '../../ui/NightScreen';
import { Notice } from '../../ui/Notice';
import { theme } from '../../ui/theme';

export default function LoginPreview() {
  const [scenario, setScenario] = useState<{
    login: LoginScenario;
    reset: PasswordResetScenario;
    recovery?: boolean;
  } | null>(null);
  const submit = useMemo(
    () => (scenario ? createMockLogin(scenario.login) : null),
    [scenario],
  );
  const resetActions = useMemo(
    () => createMockPasswordReset(scenario?.reset ?? 'success'),
    [scenario],
  );
  const login = (value: LoginScenario) =>
    setScenario({ login: value, reset: 'success' });

  if (!canUseMock()) return <Redirect href="/" />;
  if (submit)
    return (
      <LoginRecoveryFlow
        submit={submit}
        resetActions={resetActions}
        initialRecovery={scenario?.recovery}
        onExit={() => setScenario(null)}
      />
    );
  return (
    <NightScreen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          로그인 화면 미리보기
        </Text>
        <Notice
          title="가상의 정보로 확인해 주세요"
          description="실제 계정·비밀번호를 입력하지 마세요. 로그인과 비밀번호 찾기는 예시 응답이며 서버 연결·토큰 저장·실제 메일 발송은 하지 않습니다."
        />
        <Button label="성공 응답" onPress={() => login('success')} />
        <Button label="로그인 정보 오류" onPress={() => login('invalid')} />
        <Button label="연결 실패" onPress={() => login('network')} />
        {(
          [
            ['비밀번호 찾기 · 정상 안내', 'success'],
            ['비밀번호 찾기 · 미가입 주소도 같은 안내', 'unknown-email'],
            ['비밀번호 찾기 · 연결 실패 후 재시도', 'network-once'],
            ['비밀번호 찾기 · 느린 요청', 'slow'],
            ['비밀번호 찾기 · 재전송 제한(초)', 'limited-seconds'],
            ['비밀번호 찾기 · 재전송 제한(날짜)', 'limited-date'],
            ['비밀번호 찾기 · 이메일 거절', 'validation'],
            ['비밀번호 찾기 · 잘못된 접수 응답', 'invalid-response'],
          ] as const
        ).map(([label, reset]) => (
          <Button
            key={reset}
            label={label}
            onPress={() =>
              setScenario({ login: 'success', reset, recovery: true })
            }
          />
        ))}
        <Button
          label="시작 화면으로"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace('/')
          }
        />
      </ScrollView>
    </NightScreen>
  );
}
const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: theme.gutter,
    gap: 16,
  },
  title: {
    fontFamily: theme.font,
    fontWeight: '700',
    fontSize: 24,
    lineHeight: 34,
    color: theme.color.text,
  },
});

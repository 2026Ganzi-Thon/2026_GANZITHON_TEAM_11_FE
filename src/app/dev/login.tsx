import { useEffect, useMemo, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { BackHandler, ScrollView, StyleSheet, Text } from 'react-native';
import { LoginScreen } from '../../features/auth/LoginScreen';
import { createMockLogin, type LoginScenario } from '../../mocks/login';
import { Button } from '../../ui/Button';
import { NightScreen } from '../../ui/NightScreen';
import { Notice } from '../../ui/Notice';
import { theme } from '../../ui/theme';

export default function LoginPreview() {
  const [scenario, setScenario] = useState<LoginScenario | null>(null);
  const submit = useMemo(
    () => (scenario ? createMockLogin(scenario) : null),
    [scenario],
  );
  useEffect(() => {
    if (!__DEV__ || !scenario) return;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        setScenario(null);
        return true;
      },
    );
    return () => subscription.remove();
  }, [scenario]);

  if (!__DEV__) return <Redirect href="/" />;
  if (submit)
    return <LoginScreen submit={submit} onBack={() => setScenario(null)} />;
  return (
    <NightScreen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          로그인 화면 미리보기
        </Text>
        <Notice
          title="가상의 정보로 확인해 주세요"
          description="실제 계정·비밀번호를 입력하지 마세요. 선택한 예시 응답만 표시하며 서버 연결·토큰 저장은 하지 않습니다."
        />
        <Button label="성공 응답" onPress={() => setScenario('success')} />
        <Button
          label="로그인 정보 오류"
          onPress={() => setScenario('invalid')}
        />
        <Button label="연결 실패" onPress={() => setScenario('network')} />
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

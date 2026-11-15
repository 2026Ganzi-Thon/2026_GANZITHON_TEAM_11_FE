import { useMemo, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { ScrollView } from 'react-native';
import { SignupFlow } from '../../features/signup/SignupFlow';
import { createMockSignup, type SignupScenario } from '../../mocks/signup';
import { NightScreen } from '../../ui/NightScreen';
import { Notice } from '../../ui/Notice';
import { Button } from '../../ui/Button';
const scenarios: readonly [SignupScenario, string][] = [
  ['success', '가입 흐름 확인'],
  ['register-retry', '가입 연결 실패·재시도'],
  ['register-lost', '가입 응답 유실·재확인'],
  ['email-used', '이메일 중복 안내'],
  ['documents-retry', '동의 문서 조회 실패'],
  ['consent-retry', '동의 저장 실패'],
  ['version-changed', '동의 문서 버전 변경'],
  ['birth-retry', '생일 저장 실패'],
  ['age-rejected', '가입 연령 거절 예시'],
  ['slow', '느린 가입·동의·생일 저장'],
];
export default function SignupPreview() {
  const [scenario, setScenario] = useState<SignupScenario | null>(null);
  const actions = useMemo(
    () => (scenario ? createMockSignup(scenario) : null),
    [scenario],
  );
  if (!__DEV__) return <Redirect href="/" />;
  if (actions)
    return <SignupFlow actions={actions} onExit={() => setScenario(null)} />;
  return (
    <NightScreen>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20, gap: 16 }}>
        <Notice
          title="회원가입 온보딩 미리보기"
          description="가입·동의·생일 저장은 메모리 mock입니다. 실제 계정·토큰을 만들거나 정보를 전송하지 않습니다. 문서는 화면 검증용 예시이며 비밀번호는 저장하지 않습니다. 알림 권한·알림 시간·낮 안내는 다음 범위입니다. 시연을 마치면 초기화합니다."
        />
        {scenarios.map(([value, label]) => (
          <Button
            key={value}
            label={label}
            onPress={() => setScenario(value)}
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

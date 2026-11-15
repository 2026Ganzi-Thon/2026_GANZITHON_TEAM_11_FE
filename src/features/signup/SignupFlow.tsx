import { useEffect, useState, useSyncExternalStore } from 'react';
import { BackHandler, Text } from 'react-native';
import { LoginScreen } from '../auth/LoginScreen';
import type { SignupActions } from './types';
import { createSignupController } from './controller';
import { WelcomeScreen } from './WelcomeScreen';
import { EmailSignup } from './EmailSignup';
import { ConsentScreen } from './ConsentScreen';
import { BirthSignup } from './BirthSignup';
import { SignupShell, signupStyles } from './SignupShell';
export function SignupFlow(props: {
  actions: SignupActions;
  onExit: () => void;
}) {
  const [source, setSource] = useState({ actions: props.actions, version: 0 });
  if (source.actions !== props.actions)
    setSource({ actions: props.actions, version: source.version + 1 });
  return <SignupSession key={source.version} {...props} />;
}
function SignupSession({
  actions,
  onExit,
}: {
  actions: SignupActions;
  onExit: () => void;
}) {
  const [c] = useState(() => createSignupController(actions));
  const state = useSyncExternalStore(c.subscribe, c.getSnapshot, c.getSnapshot);
  useEffect(() => {
    c.start();
    return c.stop;
  }, [c]);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (state.stage === 'welcome' || state.stage === 'complete') {
        c.stop();
        onExit();
      } else c.back();
      return true;
    });
    return () => sub.remove();
  }, [c, state.stage, onExit]);
  if (state.stage === 'welcome')
    return <WelcomeScreen onSignup={c.openSignup} onLogin={c.openLogin} />;
  if (state.stage === 'login')
    return <LoginScreen submit={actions.login} onBack={c.back} />;
  if (state.stage === 'email') return <EmailSignup state={state} c={c} />;
  if (state.stage === 'consents') return <ConsentScreen state={state} c={c} />;
  if (state.stage === 'birth')
    return <BirthSignup state={state} c={c} today={actions.today} />;
  return (
    <SignupShell
      title="입력 확인"
      onBack={() => {
        c.stop();
        onExit();
      }}
      label="미리보기 마치기"
      onSubmit={() => {
        c.stop();
        onExit();
      }}
    >
      <Text style={signupStyles.title}>가입 정보 확인을 마쳤어요</Text>
      <Text style={signupStyles.body}>
        예시 계정으로 동의와 생년월일을 확인했어요. 실제 계정이나 토큰은
        생성하지 않았어요.
      </Text>
      <Text style={signupStyles.body}>
        생일 {state.result?.birth_date} · 이후 한 번 수정 가능
      </Text>
      <Text style={signupStyles.body}>
        알림 선택과 낮 가입 안내는 다음 단계에서 연결해요.
      </Text>
    </SignupShell>
  );
}

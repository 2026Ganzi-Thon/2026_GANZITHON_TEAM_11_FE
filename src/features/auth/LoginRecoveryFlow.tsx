import { useEffect, useState } from 'react';
import { BackHandler } from 'react-native';
import { LoginScreen } from './LoginScreen';
import { PasswordResetScreen } from './passwordReset/PasswordResetScreen';
import type { LoginSubmit } from './LoginScreen';
import type { PasswordResetActions } from './passwordReset/model';
interface Props {
  submit: LoginSubmit;
  resetActions: PasswordResetActions;
  onExit: () => void;
  initialRecovery?: boolean;
  onSuccess?: () => void;
}
export function LoginRecoveryFlow(props: Props) {
  const [source, setSource] = useState({
    submit: props.submit,
    reset: props.resetActions,
    version: 0,
  });
  if (source.submit !== props.submit || source.reset !== props.resetActions)
    setSource({
      submit: props.submit,
      reset: props.resetActions,
      version: source.version + 1,
    });
  return <Session key={source.version} {...props} />;
}
function Session({
  submit,
  resetActions,
  onExit,
  initialRecovery = false,
  onSuccess,
}: Props) {
  const [recover, setRecover] = useState(initialRecovery),
    [email, setEmail] = useState('');
  useEffect(() => {
    if (recover) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      onExit();
      return true;
    });
    return () => listener.remove();
  }, [recover, onExit]);
  return recover ? (
    <PasswordResetScreen
      actions={resetActions}
      initialEmail={email}
      onLogin={(value) => {
        setEmail(value);
        setRecover(false);
      }}
    />
  ) : (
    <LoginScreen
      submit={submit}
      onSuccess={onSuccess}
      initialEmail={email}
      onBack={onExit}
      onResetPassword={(value) => {
        setEmail(value);
        setRecover(true);
      }}
    />
  );
}

import { Keyboard, Text, View } from 'react-native';
import { FormField } from '../../ui/FormField';
import { SignupShell, signupStyles as s } from './SignupShell';
import type { SignupController, SignupState } from './controller';
export function EmailSignup({
  state,
  c,
}: {
  state: SignupState;
  c: SignupController;
}) {
  const locked = state.busy || !!state.registration || state.uncertain;
  return (
    <SignupShell
      onBack={c.back}
      label={
        state.busy
          ? '확인 중'
          : state.registration
            ? '계속'
            : state.uncertain
              ? '가입 결과 다시 확인'
              : state.error
                ? '다시 시도'
                : '다음'
      }
      onSubmit={() => {
        Keyboard.dismiss();
        void c.submit();
      }}
      busy={state.busy}
      error={
        state.error || Object.values(state.fields).filter(Boolean).join('\n')
      }
    >
      <Text
        accessibilityRole="header"
        style={[s.title, { fontSize: 30, lineHeight: 42 }]}
      >
        이메일로 시작해요
      </Text>
      <Text style={s.body}>양떼와 내 카드를 이 계정에 보관해요</Text>
      <View style={{ gap: 30 }}>
        <FormField
          label="e-mail"
          accessibilityLabel="이메일 주소"
          placeholder="이메일 주소"
          value={state.email}
          editable={!locked}
          error={state.fields.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          onChangeText={(v) => c.edit('email', v)}
        />
        <View style={{ gap: 14 }}>
          <FormField
            label="password"
            accessibilityLabel="비밀번호"
            placeholder="비밀번호"
            value={state.password}
            editable={!locked}
            error={state.fields.password}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            onChangeText={(v) => c.edit('password', v)}
          />
          <FormField
            label={undefined}
            accessibilityLabel="비밀번호 확인"
            placeholder="비밀번호 확인"
            value={state.confirmation}
            editable={!locked}
            error={state.fields.confirmation}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            onChangeText={(v) => c.edit('confirmation', v)}
          />
        </View>
      </View>
      {state.registration && (
        <Text style={s.body}>이 이메일의 가입 단계를 이어갈게요.</Text>
      )}
    </SignupShell>
  );
}

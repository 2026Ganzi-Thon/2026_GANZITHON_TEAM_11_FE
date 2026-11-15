import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import { DateWheel } from '../birthDate/DateWheel';
import { parseDate } from '../birthDate/date';
import { previewZodiac } from '../birthDate/zodiac';
import { zodiacNames } from '../fortune/types';
import type { SignupController, SignupState } from './controller';
import { SignupShell, signupStyles as s } from './SignupShell';
export function BirthSignup({
  state,
  c,
  today,
}: {
  state: SignupState;
  c: SignupController;
  today: string;
}) {
  const date = state.date;
  const text = `${date.month}월 ${date.day}일이면 ${zodiacNames[previewZodiac(`${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`)]}네!`;
  return (
    <SignupShell
      title="생년월일"
      background={require('../../../assets/images/signup/birth-background.svg')}
      onBack={c.back}
      label={
        state.busy
          ? '저장 중'
          : state.birthUncertain
            ? '생일 저장 결과 다시 확인'
            : state.error
              ? '다시 시도'
              : '다음'
      }
      onSubmit={() => void c.submit()}
      busy={state.busy}
      error={state.error}
    >
      <Text style={s.title}>생일을 알려 주세요</Text>
      <Text style={s.body}>매일 새벽 4시에 별자리 운세를 준비해 둘게요</Text>
      <View style={{ marginTop: 16 }}>
        <DateWheel
          value={date}
          todayYear={parseDate(today)?.year ?? date.year}
          disabled={state.busy || state.birthUncertain}
          onChange={c.changeDate}
        />
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          marginTop: 16,
        }}
      >
        <Image
          source={require('../../../assets/images/birth-date/sheep.svg')}
          style={{ width: 42.0001, height: 35 }}
          contentFit="contain"
          accessible={false}
        />
        <View
          style={{
            flex: 1,
            backgroundColor: '#3C47AD',
            paddingHorizontal: 14,
            paddingVertical: 11,
            borderRadius: 8,
          }}
        >
          <Image
            source={require('../../../assets/images/night-support/bubble-tail.svg')}
            style={{
              position: 'absolute',
              width: 13,
              height: 21,
              left: -12,
              top: '50%',
              transform: [{ translateY: -10.5 }],
            }}
            contentFit="contain"
            accessible={false}
          />
          <Text style={[s.body, { color: '#EEF0FF' }]}>{text}</Text>
        </View>
      </View>
      <Text style={s.caption}>
        생년월일은 가입 후 설정에서 한 번만 바꿀 수 있어요
      </Text>
    </SignupShell>
  );
}

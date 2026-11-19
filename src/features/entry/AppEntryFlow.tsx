import { useState } from 'react';
import { ScrollView } from 'react-native';
import {
  SignupJourneyFlow,
  type SignupJourneySource,
} from '../signup/SignupJourneyFlow';
import { NightScreen } from '../../ui/NightScreen';
import { Notice } from '../../ui/Notice';
import { Button } from '../../ui/Button';
/** Preview-only entry. The source owner retains completed accounts in memory. */
export function AppEntryFlow({
  loadSource,
  onExit,
  onTools,
}: {
  loadSource: () => SignupJourneySource;
  onExit: () => void;
  onTools: () => void;
}) {
  const [source, setSource] = useState<SignupJourneySource | null>(null),
    [error, setError] = useState(false);
  if (source) return <SignupJourneyFlow source={source} onExit={onExit} />;
  return (
    <NightScreen>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          padding: 24,
          justifyContent: 'center',
          gap: 20,
        }}
      >
        <Notice
          title="테스트 체험판"
          description="가입·로그인·고민·카드는 예시로 동작해요. 가상의 정보를 사용해 주세요. 입력과 기록은 체험 중에만 유지돼요. 기기 알림과 외부 앱 열기는 실제로 동작해요."
        />
        {error && (
          <Notice
            title="시작 준비를 마치지 못했어요"
            description="다시 시도해 주세요."
            error
          />
        )}
        <Button
          label="체험 시작"
          onPress={() => {
            setError(false);
            try {
              setSource(loadSource());
            } catch {
              setError(true);
            }
          }}
        />
        <Button label="기능별 미리보기" onPress={onTools} />
      </ScrollView>
    </NightScreen>
  );
}

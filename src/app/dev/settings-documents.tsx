import { useMemo, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { ScrollView } from 'react-native';
import { canUseMock } from '../../config/runtime';
import { SettingsScreen } from '../../features/settings/SettingsScreen';
import { createMockSettings } from '../../mocks/settings';
import {
  createMockLegalDocuments,
  type LegalDocumentsScenario,
} from '../../mocks/legalDocuments';
import { NightScreen } from '../../ui/NightScreen';
import { Notice } from '../../ui/Notice';
import { Button } from '../../ui/Button';
type Scenario = LegalDocumentsScenario | 'standalone';
const scenarios: readonly [Scenario, string][] = [
  ['success', '설정 이메일·문서 확인'],
  ['long', '긴 이메일·긴 문서'],
  ['retry', '문서 조회 실패·재시도'],
  ['slow', '느린 문서 조회·닫기'],
  ['standalone', '독립 설정·뒤로가기'],
];
export default function SettingsDocumentsPreview() {
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const actions = useMemo(() => {
    if (!scenario) return null;
    const a = createMockSettings();
    const load = a.loadMe;
    return {
      ...a,
      documents: createMockLegalDocuments(
        scenario === 'standalone' ? 'success' : scenario,
      ),
      loadMe: async (signal: AbortSignal) => {
        const d = await load(signal);
        return {
          ...d,
          user: {
            ...d.user,
            email:
              scenario === 'long'
                ? 'very.long.example.account.for.readability.check@example.com'
                : d.user.email,
          },
        };
      },
    };
  }, [scenario]);
  if (!canUseMock()) return <Redirect href="/" />;
  if (actions)
    return (
      <SettingsScreen
        modal={scenario !== 'standalone'}
        actions={actions}
        onBack={() => setScenario(null)}
      />
    );
  return (
    <NightScreen>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, flexGrow: 1 }}>
        <Notice
          title="설정 이메일·문서 열람"
          description="계정과 문서는 메모리 mock이며 실제 약관 원문이 아니에요. 문서를 읽어도 동의 내용은 바뀌지 않아요. 가입한 계정과의 연결은 가입 → 첫 홈 → 설정에서도 확인할 수 있어요."
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

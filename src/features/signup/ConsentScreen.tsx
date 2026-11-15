import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../ui/Button';
import { theme } from '../../ui/theme';
import { consentIds, type ConsentDocument, type ConsentId } from './types';
import type { SignupController, SignupState } from './controller';
import { SignupShell, signupStyles as common } from './SignupShell';
function Check({ checked }: { checked: boolean }) {
  return (
    <View style={s.check}>
      {checked ? (
        <Image
          source={require('../../../assets/images/signup/checked.svg')}
          style={{
            position: 'absolute',
            left: -4,
            top: -4,
            width: 30,
            height: 30,
          }}
          contentFit="contain"
          accessible={false}
        />
      ) : (
        <View style={s.off} />
      )}
    </View>
  );
}
export function ConsentScreen({
  state,
  c,
}: {
  state: SignupState;
  c: SignupController;
}) {
  const [document, setDocument] = useState<ConsentDocument | null>(null);
  const blocked = state.busy || state.documentLoading || !state.documents;
  const titles = {
    terms: '[필수] 서비스 이용약관',
    privacy: '[필수] 개인정보 수집 · 이용',
    processing: '[필수] 고민 글 외부 AI 전송',
    notifications: '[선택] 알림 수신',
  };
  const row = (id: ConsentId | 'all') => (
    <View key={id} style={[s.row, id === 'all' && s.all]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={id === 'all' ? '전체 동의' : titles[id]}
        accessibilityState={{
          checked:
            id === 'all'
              ? consentIds.every((key) => state.choices[key])
              : state.choices[id],
          disabled: blocked,
        }}
        disabled={blocked}
        onPress={() => c.toggle(id)}
        style={s.choice}
      >
        <Check
          checked={
            id === 'all'
              ? consentIds.every((key) => state.choices[key])
              : state.choices[id]
          }
        />
        <Text
          style={[s.label, id === 'all' && { fontWeight: '700', fontSize: 16 }]}
        >
          {id === 'all' ? '전체 동의' : titles[id]}
        </Text>
      </Pressable>
      {id !== 'all' && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${titles[id].replace(/^\[.*?\] /, '')} 보기`}
          disabled={blocked}
          onPress={() =>
            setDocument(state.documents!.documents.find((d) => d.id === id)!)
          }
          style={s.view}
        >
          <Text style={s.viewText}>보기</Text>
        </Pressable>
      )}
    </View>
  );
  return (
    <>
      <SignupShell
        title="약관 동의"
        background={require('../../../assets/images/signup/consent-background.svg')}
        onBack={c.back}
        label={state.busy ? '저장 중' : '동의하고 계속'}
        onSubmit={() => void c.submit()}
        busy={state.busy}
        disabled={
          blocked ||
          !state.choices.terms ||
          !state.choices.privacy ||
          !state.choices.processing
        }
        error={state.error}
      >
        <Text style={common.title}>시작하기 전 확인해 주세요</Text>
        <View style={{ marginTop: 10 }}>
          {consentIds.map(row)}
          {row('all')}
        </View>
        {state.documentLoading && (
          <View style={common.group}>
            <ActivityIndicator color={theme.color.primary} />
            <Text accessibilityLiveRegion="polite" style={common.body}>
              동의 문서를 불러오고 있어요.
            </Text>
          </View>
        )}
        {state.documentError && (
          <View style={common.group}>
            <Text accessibilityRole="alert" style={common.body}>
              동의 문서를 확인하지 못했어요.
            </Text>
            <Button
              label="동의 문서 다시 불러오기"
              onPress={() => void c.reload()}
            />
          </View>
        )}
        <View style={s.notice}>
          <Text style={[common.caption, { fontSize: 12, lineHeight: 18 }]}>
            고민 글은 카드 추천과 위기 감지를 위해 AI에 전달돼요.{'\n'}이름이나
            연락처는 보내지 않아요.
          </Text>
        </View>
      </SignupShell>
      {document && (
        <Modal
          transparent
          visible
          animationType="none"
          onRequestClose={() => setDocument(null)}
        >
          <SafeAreaView style={s.shade}>
            <View style={s.document}>
              <ScrollView contentContainerStyle={common.group}>
                <Text accessibilityRole="header" style={common.title}>
                  {document.title}
                </Text>
                <Text style={common.caption}>
                  예시 문서 · {document.version}
                </Text>
                <Text style={common.body}>{document.body}</Text>
              </ScrollView>
              <Button label="문서 닫기" onPress={() => setDocument(null)} />
            </View>
          </SafeAreaView>
        </Modal>
      )}
    </>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 50 },
  choice: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    minHeight: 48,
  },
  check: { width: 22, height: 22 },
  off: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: '#4A5BC2',
    backgroundColor: '#1E2063',
  },
  label: {
    fontFamily: theme.font,
    fontSize: 14,
    lineHeight: 21,
    color: theme.color.text,
    flex: 1,
  },
  view: {
    minWidth: 40,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  viewText: {
    fontFamily: theme.font,
    fontSize: 12,
    lineHeight: 18,
    color: theme.color.muted,
  },
  all: {
    borderTopWidth: 1,
    borderColor: '#3A43A0',
    marginTop: 10,
    paddingTop: 8,
  },
  notice: {
    marginTop: 30,
    backgroundColor: '#2B3591',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 4,
  },
  shade: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  document: {
    maxHeight: '90%',
    backgroundColor: '#242565',
    padding: 20,
    gap: 20,
    borderWidth: 1,
    borderColor: '#D6A8FF',
  },
});

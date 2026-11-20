import { DocumentDialog } from '../legal/DocumentDialog';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Button } from '../../ui/Button';
import { theme } from '../../ui/theme';
import { consentIds, type ConsentDocument } from './types';
import {
  legalDocumentIds,
  hasRequiredConsents,
  type LegalDocumentId,
} from '../legal/model';
import { previewDocumentTitles } from '../legal/previewPolicy';
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
  const title = (id: LegalDocumentId) =>
    state.documents?.documents.find((d) => d.id === id)?.title ??
    previewDocumentTitles[id];
  const row = (id: LegalDocumentId | 'all') =>
    id === 'processing' ? (
      <View key={id} style={s.row}>
        <View style={[s.choice, { paddingLeft: 34 }]}>
          <Text style={s.label}>[안내] {title(id)}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title(id)} 보기`}
          disabled={blocked}
          onPress={() =>
            setDocument(state.documents!.documents.find((d) => d.id === id)!)
          }
          style={s.view}
        >
          <Text style={s.viewText}>보기</Text>
        </Pressable>
      </View>
    ) : (
      <View key={id} style={[s.row, id === 'all' && s.all]}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel={
            id === 'all'
              ? '전체 동의'
              : `[${id === 'notifications' ? '선택' : '필수'}] ${title(id)}`
          }
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
            style={[
              s.label,
              id === 'all' && { fontWeight: '700', fontSize: 18 },
            ]}
          >
            {id === 'all'
              ? '전체 동의'
              : `[${id === 'notifications' ? '선택' : '필수'}] ${title(id)}`}
          </Text>
        </Pressable>
        {id !== 'all' && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${title(id)} 보기`}
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
        disabled={blocked || !hasRequiredConsents(state.choices)}
        error={state.error}
      >
        <Text style={common.title}>시작하기 전 확인해 주세요</Text>
        <View style={{ marginTop: 10 }}>
          {legalDocumentIds.map(row)}
          {row('all')}
          <Text style={common.caption}>
            전체 동의에는 선택 항목인 알림 수신이 포함돼요.
          </Text>
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
          <Text style={[common.caption, { fontSize: 14, lineHeight: 21 }]}>
            현재 체험판은 고민 글을 외부 AI로 전송하지 않아요. 분류·추천·운세는
            준비된 예시예요. 실제 개인정보는 입력하지 말아 주세요.
          </Text>
        </View>
      </SignupShell>
      {document && (
        <DocumentDialog document={document} onClose={() => setDocument(null)} />
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
    fontSize: 16,
    lineHeight: 24,
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
    fontSize: 14,
    lineHeight: 21,
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
});

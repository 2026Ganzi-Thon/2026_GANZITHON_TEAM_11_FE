import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  View,
  StyleSheet,
} from 'react-native';
import { NightScreen } from '../../ui/NightScreen';
import { Header } from '../settings/Header';
import { Button } from '../../ui/Button';
import { theme } from '../../ui/theme';
import { DocumentDialog } from './DocumentDialog';
import {
  validDocuments,
  type ConsentDocument,
  type ConsentDocuments,
  type LegalDocumentActions,
} from './model';
export function LegalDocumentsScreen({
  actions,
  onBack,
}: {
  actions: LegalDocumentActions;
  onBack: () => void;
}) {
  const [attempt, retry] = useState(0),
    [state, setState] = useState<{ data?: ConsentDocuments; error: boolean }>({
      error: false,
    }),
    [selected, setSelected] = useState<ConsentDocument | null>(null);
  useEffect(() => {
    const c = new AbortController();
    void Promise.resolve()
      .then(() => {
        if (c.signal.aborted) return;
        setState({ error: false });
        return actions.load(c.signal);
      })
      .then((value) => {
        if (c.signal.aborted) return;
        if (!validDocuments(value)) throw new Error('Invalid documents');
        setState({
          error: false,
          data: {
            revision: value.revision,
            documents: value.documents.map((d) => ({ ...d })),
          },
        });
      })
      .catch(() => {
        if (!c.signal.aborted) setState({ error: true });
      });
    return () => c.abort();
  }, [actions, attempt]);
  return (
    <NightScreen
      background={require('../../../assets/images/settings/background.svg')}
    >
      <Header
        title="약관 · 개인정보"
        backLabel="설정으로 돌아가기"
        onBack={onBack}
      />
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.panel}>
          <Text style={s.body}>
            가입 화면에서 확인한 문서예요. 열람만으로 동의 선택은 바뀌지 않아요.
          </Text>
        </View>
        {state.error ? (
          <View style={s.panel}>
            <Text accessibilityRole="alert" style={s.body}>
              문서를 불러오지 못했어요.
            </Text>
            <Button
              label="문서 다시 불러오기"
              onPress={() => retry((n) => n + 1)}
            />
          </View>
        ) : !state.data ? (
          <View style={s.panel} accessibilityLiveRegion="polite">
            <ActivityIndicator color={theme.color.primary} />
            <Text style={s.body}>문서를 불러오고 있어요.</Text>
          </View>
        ) : (
          state.data.documents.map((d) => (
            <View key={d.id} style={s.panel}>
              <Text style={s.caption}>문서 버전 · {d.version}</Text>
              <Button
                label={`${d.title} 보기`}
                onPress={() => setSelected(d)}
              />
            </View>
          ))
        )}
      </ScrollView>
      {selected && (
        <DocumentDialog document={selected} onClose={() => setSelected(null)} />
      )}
    </NightScreen>
  );
}
const s = StyleSheet.create({
  content: { padding: 20, gap: 16, flexGrow: 1 },
  panel: { backgroundColor: theme.color.panel, padding: 16, gap: 12 },
  body: {
    fontFamily: theme.font,
    fontSize: 14,
    lineHeight: 23,
    color: theme.color.text,
  },
  caption: {
    fontFamily: theme.font,
    fontSize: 12,
    lineHeight: 20,
    color: theme.color.muted,
  },
});

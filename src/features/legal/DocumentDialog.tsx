import {
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../ui/Button';
import { theme } from '../../ui/theme';
import type { ConsentDocument } from './model';
/** Reading a document never changes consent. */
export function DocumentDialog({
  document,
  onClose,
}: {
  document: ConsentDocument;
  onClose: () => void;
}) {
  const [linkError, setLinkError] = useState(false);
  return (
    <Modal
      transparent
      visible
      animationType="none"
      onRequestClose={onClose}
      testID="legal-document-modal"
    >
      <SafeAreaView style={s.shade}>
        <View style={s.document} accessibilityViewIsModal>
          <ScrollView
            style={{ flexShrink: 1 }}
            contentContainerStyle={{ gap: 16 }}
          >
            <Text accessibilityRole="header" style={s.title}>
              {document.title}
            </Text>
            <Text style={s.caption}>문서 버전 · {document.version}</Text>
            <Text style={s.body}>{document.body}</Text>
            {!!document.body_url && (
              <Button
                label="서버 약관 원문 열기"
                onPress={() => {
                  setLinkError(false);
                  void Linking.openURL(document.body_url!).catch(() =>
                    setLinkError(true),
                  );
                }}
              />
            )}
            {linkError && (
              <Text accessibilityRole="alert" style={s.body}>
                원문을 열지 못했어요. 잠시 후 다시 시도해 주세요.
              </Text>
            )}
          </ScrollView>
          <Button label="문서 닫기" onPress={onClose} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
const s = StyleSheet.create({
  shade: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  document: {
    maxHeight: '90%',
    backgroundColor: theme.color.background,
    padding: 20,
    gap: 20,
    borderWidth: 1,
    borderColor: theme.color.primary,
  },
  title: {
    fontFamily: theme.font,
    fontSize: 24,
    lineHeight: 36,
    fontWeight: '700',
    color: theme.color.text,
  },
  body: {
    fontFamily: theme.font,
    fontSize: 16,
    lineHeight: 26,
    color: theme.color.text,
  },
  caption: {
    fontFamily: theme.font,
    fontSize: 14,
    lineHeight: 22,
    color: theme.color.muted,
  },
});

import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
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
            <Text style={s.caption}>예시 문서 · {document.version}</Text>
            <Text style={s.body}>{document.body}</Text>
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
    fontSize: 20,
    lineHeight: 30,
    fontWeight: '700',
    color: theme.color.text,
  },
  body: {
    fontFamily: theme.font,
    fontSize: 14,
    lineHeight: 24,
    color: theme.color.text,
  },
  caption: {
    fontFamily: theme.font,
    fontSize: 12,
    lineHeight: 20,
    color: theme.color.muted,
  },
});

import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../ui/Button';
import { theme } from '../../ui/theme';

export function SubmissionRecoveryPanel({
  original,
  pending,
  onRecover,
}: {
  original: string;
  pending: boolean;
  onRecover: () => void;
}) {
  return (
    <View style={styles.panel}>
      <Text style={styles.title} accessibilityRole="header">
        이전 접수를 먼저 확인해 주세요
      </Text>
      <Text style={styles.text}>
        아래의 처음 보낸 내용으로 접수를 확인해요. 지금 편집한 내용은 새로
        보내지 않아요.
      </Text>
      <Text style={styles.text}>처음 보낸 내용: {original}</Text>
      <Button label="이전 접수 확인" busy={pending} onPress={onRecover} />
    </View>
  );
}
const styles = StyleSheet.create({
  panel: { backgroundColor: '#2B3591', padding: 20, gap: 14 },
  title: {
    fontFamily: theme.font,
    color: theme.color.text,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
  },
  text: {
    fontFamily: theme.font,
    color: theme.color.text,
    fontSize: 14,
    lineHeight: 22,
  },
});

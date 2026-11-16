import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../../../ui/theme';
import type { NightReturnRecord } from './model';
export function ReturnRecordCard({ record }: { record: NightReturnRecord }) {
  const s = record.summary,
    at = new Date(Date.parse(s.finished_at) + 9 * 60 * 60 * 1000)
      .toISOString()
      .slice(11, 16);
  return (
    <View style={styles.note}>
      <Image
        source={require('../../../../assets/images/night-return/note-shadow.svg')}
        style={styles.shadow}
        contentFit="fill"
        accessible={false}
      />
      <Image
        source={require('../../../../assets/images/night-return/note-border.svg')}
        style={StyleSheet.absoluteFill}
        contentFit="fill"
        accessible={false}
      />
      <Image
        source={require('../../../../assets/images/night-return/note-fill.svg')}
        style={styles.fill}
        contentFit="fill"
        accessible={false}
      />
      <View style={styles.tape} />
      <Text style={styles.label}>오늘 밤 기록</Text>
      <Text style={styles.title}>
        {at}에 {s.counted}마리
        {s.status === 'completed' ? ' 다 셌어요' : '까지 셌어요'}
      </Text>
      <Text style={styles.meta}>
        맡긴 걱정 {s.entrusted_count}개 · 솜털 {s.fluff_count}개 · 털실{' '}
        {s.yarn_sent_count}개
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  note: { marginTop: 16, marginBottom: 7, padding: 16, gap: 6, minHeight: 95 },
  shadow: { position: 'absolute', top: 7, left: 6, right: -6, bottom: -7 },
  fill: { position: 'absolute', top: 2, left: 2, right: 2, bottom: 2 },
  tape: {
    position: 'absolute',
    top: -8,
    left: '50%',
    marginLeft: -30,
    width: 60,
    height: 16,
    backgroundColor: '#D6A8FF99',
  },
  label: {
    fontFamily: theme.font,
    fontSize: 11,
    lineHeight: 16,
    color: '#74584D',
  },
  title: {
    fontFamily: theme.font,
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 24,
    color: theme.color.background,
  },
  meta: {
    fontFamily: theme.font,
    fontSize: 12,
    lineHeight: 18,
    color: '#4A5290',
  },
});

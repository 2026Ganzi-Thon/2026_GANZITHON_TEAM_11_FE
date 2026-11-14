import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { NightScreen } from '../../ui/NightScreen';
import { Button } from '../../ui/Button';
import { theme } from '../../ui/theme';
import { categories } from '../night/categories';
import { reflectionLabels } from '../morning/reflection';
import type { WorryListActions } from './types';
import { useWorryList } from './useWorryList';
import { Header } from './Header';
export function WorryListScreen({
  actions,
  total,
  onBack,
}: {
  actions: WorryListActions;
  total: number;
  onBack: () => void;
}) {
  const flow = useWorryList(actions);
  return (
    <NightScreen
      background={require('../../../assets/images/settings/worry-background.svg')}
    >
      <Header
        title="고민 기록"
        backLabel="설정으로 돌아가기"
        onBack={() => {
          flow.cancel();
          onBack();
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.summary}>고민 기록 {total}개</Text>
        {flow.items.map((item) => {
          const category = categories.find((c) => c.id === item.category_id)!;
          return (
            <View key={item.night_id} style={styles.record}>
              <View style={styles.metadata}>
                <Text style={styles.caption}>{item.night_date} 밤</Text>
                <View style={styles.category}>
                  <View
                    style={[styles.dot, { backgroundColor: category.color }]}
                  />
                  <Text style={styles.categoryText}>{category.label}</Text>
                </View>
              </View>
              <Text style={styles.body}>{item.worry_text}</Text>
              {item.reflection && (
                <Text style={styles.caption}>
                  아침에 돌아본 답 · {reflectionLabels[item.reflection.answer]}
                </Text>
              )}
            </View>
          );
        })}
        {flow.loading && (
          <View style={styles.state}>
            <ActivityIndicator color={theme.color.primary} />
            <Text style={styles.summary}>
              {flow.loaded
                ? '기록을 더 불러오고 있어요.'
                : '고민 기록을 불러오고 있어요.'}
            </Text>
          </View>
        )}
        {flow.error && (
          <View style={styles.state}>
            <Text accessibilityRole="alert" style={styles.body}>
              {flow.error === 'more'
                ? '기록을 더 불러오지 못했어요. 앞의 기록은 그대로예요.'
                : '고민 기록을 불러오지 못했어요.'}
            </Text>
            <Button
              label={
                flow.error === 'more'
                  ? '더 보기 다시 시도'
                  : '고민 기록 다시 불러오기'
              }
              onPress={flow.retry}
            />
          </View>
        )}
        {flow.loaded && !flow.items.length && (
          <View style={styles.state}>
            <Text style={styles.body}>저장된 고민 없음</Text>
            <Text style={styles.caption}>
              원문이 남아 있는 고민을 이곳에서 볼 수 있어요.
            </Text>
          </View>
        )}
        {!flow.error && flow.loaded && flow.nextCursor !== null && (
          <Button label="더 보기" busy={flow.loading} onPress={flow.loadMore} />
        )}
        <View style={styles.info}>
          <Image
            source={require('../../../assets/images/settings/info.svg')}
            style={{ width: 18, height: 18 }}
            accessible={false}
          />
          <Text style={styles.summary}>고민은 자동으로 지워지지 않아요.</Text>
        </View>
      </ScrollView>
    </NightScreen>
  );
}
const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 26,
    gap: 14,
    flexGrow: 1,
  },
  summary: {
    fontFamily: theme.font,
    color: theme.color.muted,
    fontSize: 13,
    lineHeight: 21,
    flexShrink: 1,
  },
  record: {
    backgroundColor: '#2B3591',
    padding: 14,
    gap: 8,
    boxShadow: '4px 4px 0 #0E1040',
  },
  metadata: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  caption: {
    fontFamily: theme.font,
    color: theme.color.muted,
    fontSize: 12,
    lineHeight: 20,
  },
  category: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#1E2063',
  },
  dot: { width: 6, height: 6 },
  categoryText: {
    fontFamily: theme.font,
    color: theme.color.text,
    fontSize: 11,
    lineHeight: 18,
  },
  body: {
    fontFamily: theme.font,
    color: theme.color.text,
    fontSize: 13,
    lineHeight: 21,
  },
  info: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingTop: 4,
  },
  state: { backgroundColor: '#1E2063', padding: 16, gap: 14 },
});

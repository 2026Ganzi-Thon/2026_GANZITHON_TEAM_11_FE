import type { ReactNode } from 'react';
import { Image, type ImageSource } from 'expo-image';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { theme } from '../../ui/theme';
import { useSettings } from '../settings/useSettings';
import type { SettingsActions } from '../settings/types';
function Icon({
  label,
  source,
  width,
  height,
  onPress,
}: {
  label: string;
  source: ImageSource;
  width: number;
  height: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.icon}
    >
      <Image
        source={source}
        contentFit="contain"
        style={{ width, height }}
        accessible={false}
      />
    </Pressable>
  );
}
export function MorningHomeHeader({
  date,
  settings,
  onSettings,
  onCards,
  yarn,
  profileVisible = true,
}: {
  date?: string;
  settings?: SettingsActions;
  onSettings: () => void;
  onCards?: () => void;
  yarn?: ReactNode;
  profileVisible?: boolean;
}) {
  return (
    <View>
      <View style={styles.top}>
        <Text style={styles.month}>
          {date ? date.slice(0, 7).replace('-', '.') : '나의 양떼'}
        </Text>
        <View style={styles.icons}>
          {onCards && (
            <Icon
              label="내 카드 열기"
              source={require('../../../assets/images/first-night-home/my-cards.svg')}
              width={24}
              height={18}
              onPress={onCards}
            />
          )}
          {yarn}
          {settings && (
            <Icon
              label="설정 열기"
              source={require('../../../assets/images/first-night-home/settings.svg')}
              width={20}
              height={20}
              onPress={onSettings}
            />
          )}
        </View>
      </View>
      {settings ? (
        profileVisible ? (
          <Profile actions={settings} />
        ) : null
      ) : (
        <Text
          accessibilityRole="header"
          accessibilityLabel="나의 양떼"
          style={styles.fallback}
        >
          밤을 함께 보낸 양들이 쉬고 있어요.
        </Text>
      )}
    </View>
  );
}
function Profile({ actions }: { actions: SettingsActions }) {
  const flow = useSettings(actions),
    stats = flow.data?.user.stats;
  return (
    <View style={styles.profile}>
      {flow.loading ? (
        <ActivityIndicator
          accessibilityLabel="홈 기록 불러오는 중"
          color="#2F3A9E"
        />
      ) : flow.error || !stats ? (
        <View style={styles.feedback}>
          <Text
            accessibilityRole="header"
            accessibilityLabel="나의 양떼"
            style={styles.text}
          >
            홈 기록을 확인하지 못했어요.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="홈 기록 다시 불러오기"
            onPress={flow.retry}
            style={styles.retry}
          >
            <Text style={styles.text}>홈 기록 다시 불러오기</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View
            accessible
            accessibilityRole="header"
            accessibilityLabel={`나의 양떼 · ${stats.night_count}밤`}
            style={styles.stats}
          >
            <Text style={styles.count}>{stats.night_count}</Text>
            <Text style={styles.nights}>밤</Text>
            <Image
              source={require('../../../assets/images/morning-home/constellation.svg')}
              contentFit="contain"
              style={styles.constellation}
              accessible={false}
            />
          </View>
          <Text style={styles.caption}>
            양을 세고 잠든 밤 · 총{' '}
            {stats.counted_sheep_total.toLocaleString('ko-KR')}마리
          </Text>
        </>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 4,
  },
  icons: { flexDirection: 'row', alignItems: 'center' },
  icon: {
    width: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  month: {
    fontFamily: theme.font,
    color: '#2F3A9E',
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '700',
  },
  profile: { gap: 4, minHeight: 100 },
  stats: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    columnGap: 10,
  },
  count: {
    fontFamily: theme.font,
    color: '#2F3A9E',
    fontSize: 64,
    lineHeight: 78,
    fontWeight: '700',
    includeFontPadding: false,
  },
  nights: {
    fontFamily: theme.font,
    color: '#2F3A9E',
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '700',
  },
  constellation: { width: 70, height: 40, alignSelf: 'center', marginLeft: 6 },
  caption: {
    fontFamily: theme.font,
    color: '#3D489B',
    fontSize: 12,
    lineHeight: 20,
  },
  fallback: {
    fontFamily: theme.font,
    color: '#2F3A9E',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 16,
  },
  feedback: { padding: 12, backgroundColor: '#FFFFFF', gap: 4 },
  text: {
    fontFamily: theme.font,
    color: '#2F3A9E',
    fontSize: 14,
    lineHeight: 22,
  },
  retry: { minHeight: 44, justifyContent: 'center' },
});

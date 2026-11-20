import { useEffect, useState } from 'react';
import { Image, type ImageSource } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import {
  Animated,
  BackHandler,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { theme } from '../../ui/theme';
import { FortuneSection } from '../fortune/FortuneSection';
import { SettingsScreen } from '../settings/SettingsScreen';
import { MyCardsWritingFlow } from '../myCards/MyCardsWritingFlow';
import { FirstNightArtwork } from './FirstNightArtwork';
import { HomeNightButton } from './HomeNightButton';
import { fortuneDate } from './model';
import { SheepWander, usePastureMotion } from '../morning/SheepWander';
import type { HomeContext } from './useHomeContext';
import type { HomeSource } from './types';
function Icon({
  label,
  source,
  width,
  height,
  onPress,
  disabled = false,
}: {
  label: string;
  source: ImageSource;
  width: number;
  height: number;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={styles.icon}
    >
      <Image
        source={source}
        style={{ width, height }}
        contentFit="contain"
        accessible={false}
      />
    </Pressable>
  );
}
export function FirstNightHome({
  source,
  flow,
  onExit,
}: {
  source: HomeSource;
  flow: HomeContext;
  onExit: () => void;
}) {
  const { width, fontScale } = useWindowDimensions(),
    insets = useSafeAreaInsets(),
    scale = Math.min(width, 480) / 360;
  const [panel, setPanel] = useState<'settings' | 'cards' | null>(null),
    [fortuneOpen, setFortuneOpen] = useState(false),
    [fortuneVersion, setFortuneVersion] = useState(0);
  const bubbleScale = Math.max(
    scale,
    Math.min(fontScale, (Math.min(width, 480) - 40) / 153),
  );
  const wandering = usePastureMotion(panel === null && !fortuneOpen);
  const date = flow.snapshot
    ? fortuneDate(Date.parse(flow.snapshot.server_time))
    : '';
  const closePanel = () => {
    setPanel(null);
    setFortuneVersion((v) => v + 1);
    flow.refresh();
  };
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      onExit();
      return true;
    });
    return () => listener.remove();
  }, [onExit]);
  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <View
        style={[
          { position: 'absolute', top: 0, bottom: 0 },
          { width: Math.min(width, 480), alignSelf: 'center' },
        ]}
      >
        <FirstNightArtwork scale={scale} />
      </View>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.heading}>
            <View style={styles.month}>
              <Text style={styles.monthText}>
                {date.slice(0, 7).replace('-', '.')}
              </Text>
              <Image
                source={require('../../../assets/images/first-night-home/month-chevron.svg')}
                style={{ width: 9, height: 5 }}
                accessible={false}
              />
            </View>
            <View style={styles.icons}>
              <Icon
                label="내 카드 열기"
                source={require('../../../assets/images/first-night-home/my-cards.svg')}
                width={24}
                height={18}
                disabled={!source.cards || fortuneOpen}
                onPress={() => setPanel('cards')}
              />
              <Icon
                label="받은 털실 알림 · 준비 중"
                source={require('../../../assets/images/first-night-home/notifications.svg')}
                width={24.75}
                height={22}
                disabled
              />
              <Icon
                label="설정 열기"
                source={require('../../../assets/images/first-night-home/settings.svg')}
                width={20}
                height={20}
                disabled={!source.settings || fortuneOpen}
                onPress={() => setPanel('settings')}
              />
            </View>
          </View>
          <View
            style={styles.stats}
            accessible
            accessibilityLabel="센 밤 수"
            accessibilityValue={{ text: '0밤' }}
          >
            <Text style={styles.zero}>0</Text>
            <View style={{ paddingLeft: 42 * scale, paddingTop: 43 }}>
              <Text style={styles.nights}>밤</Text>
            </View>
            <View style={{ paddingLeft: 16, paddingTop: 16 }}>
              <Image
                source={require('../../../assets/images/first-night-home/constellation.svg')}
                contentFit="contain"
                style={{ width: 70, height: 40 }}
                accessible={false}
              />
            </View>
          </View>
          <Text style={[styles.empty, fontScale > 1.3 && styles.largeEmpty]}>
            아직 센 양이 없어요
          </Text>
          <View style={{ height: Math.max(100, 225 - insets.top) * scale }} />
          <View style={[styles.pasture, { minHeight: 250 * scale }]}>
            <FirstNightArtwork scale={scale} pasture />
            <View
              style={{
                marginTop: 6 * scale,
                marginLeft: fontScale > 1.3 ? 20 : 78 * scale,
                alignItems: 'flex-start',
              }}
            >
              <View
                style={{
                  marginLeft: fontScale > 1.3 ? 0 : 4 * scale,
                  width: 153 * bubbleScale,
                  minHeight: 36 * bubbleScale,
                  paddingHorizontal: 12 * bubbleScale,
                  paddingVertical: 8 * bubbleScale,
                  justifyContent: 'center',
                }}
              >
                <Image
                  source={require('../../../assets/images/first-night-home/guide-bubble.svg')}
                  contentFit="contain"
                  style={StyleSheet.absoluteFill}
                  accessible={false}
                />
                <Text style={styles.guide}>오늘 밤 첫 양을 데려와 줘!</Text>
              </View>
              <SheepWander
                id="first-night-guide"
                enabled={wandering}
                bounds={{
                  minX: 0,
                  maxX: 110 * scale,
                  minY: 0,
                  maxY: 38 * scale,
                }}
              >
                {(facing) => (
                  <Animated.View style={{ transform: [{ scaleX: facing }] }}>
                    <Image
                      source={require('../../../assets/images/first-night-home/guide-sheep.png')}
                      contentFit="contain"
                      style={{
                        marginTop: 4 * scale,
                        width: 36 * scale,
                        height: 30 * scale,
                      }}
                      accessible={false}
                    />
                  </Animated.View>
                )}
              </SheepWander>
            </View>
            <View
              style={{
                marginTop: 75 * scale,
                marginLeft: 208 * scale,
                alignSelf: 'flex-start',
                maxWidth: Math.min(width, 480) - 208 * scale - 12,
              }}
            >
              <FortuneSection
                key={`${date}:${fortuneVersion}`}
                compact
                actions={source.fortune}
                blocked={panel !== null}
                onVisibilityChange={setFortuneOpen}
              />
            </View>
            <View style={{ height: 40 * scale }} />
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <HomeNightButton
            flow={flow}
            blocked={panel !== null || fortuneOpen}
          />
        </View>
      </SafeAreaView>
      {panel === 'settings' && source.settings && (
        <SettingsScreen modal actions={source.settings} onBack={closePanel} />
      )}
      {panel === 'cards' && source.cards && (
        <Modal
          visible
          animationType="none"
          onRequestClose={closePanel}
          statusBarTranslucent
          navigationBarTranslucent
        >
          <MyCardsWritingFlow
            source={source.cards}
            settings={source.settings}
            onBack={closePanel}
          />
        </Modal>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#D8DFFF' },
  safe: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' },
  content: { flexGrow: 1 },
  heading: {
    minHeight: 44,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    flexWrap: 'wrap',
  },
  month: {
    paddingLeft: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  monthText: {
    fontFamily: theme.font,
    color: '#2F3A9E',
    fontSize: 16,
    lineHeight: 24,
  },
  icons: { flexDirection: 'row' },
  icon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stats: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  zero: {
    fontFamily: theme.font,
    color: '#2F3A9E',
    fontSize: 64,
    lineHeight: 77,
    fontWeight: '700',
    includeFontPadding: false,
  },
  nights: {
    fontFamily: theme.font,
    color: '#2F3A9E',
    fontWeight: '700',
    fontSize: 20,
    lineHeight: 30,
  },
  empty: {
    fontFamily: theme.font,
    color: '#4A5290',
    fontSize: 14,
    lineHeight: 21,
    paddingHorizontal: 20,
  },
  largeEmpty: { backgroundColor: '#C1CAFF', alignSelf: 'flex-start' },
  pasture: { flexGrow: 1, overflow: 'hidden', paddingBottom: 20 },
  guide: {
    fontFamily: theme.font,
    color: '#242565',
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '700',
    includeFontPadding: false,
  },
  footer: { backgroundColor: '#73AE8A' },
});

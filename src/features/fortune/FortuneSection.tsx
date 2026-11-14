import { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../ui/Button';
import { theme } from '../../ui/theme';
import { FortuneSheep, ScrollRod } from './FortuneArtwork';
import {
  publicRank,
  sheepNames,
  zodiacNames,
  type FortuneActions,
} from './types';
import { useFortune } from './useFortune';
type Props = {
  actions: FortuneActions;
  blocked?: boolean;
  onVisibilityChange: (open: boolean) => void;
};
export function FortuneSection(props: Props) {
  const [source, setSource] = useState({ actions: props.actions, version: 0 });
  if (source.actions !== props.actions)
    setSource({ actions: props.actions, version: source.version + 1 });
  return <FortuneSession key={source.version} {...props} />;
}
function FortuneSession({
  actions,
  blocked = false,
  onVisibilityChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const flow = useFortune(actions),
    f = flow.fortune;
  const rank = f ? publicRank(f) : null;
  useEffect(() => () => onVisibilityChange(false), [onVisibilityChange]);
  const close = () => {
    setOpen(false);
    onVisibilityChange(false);
  };
  const feedback = (
    <>
      {flow.pending && (
        <ActivityIndicator
          accessibilityLabel="운세 불러오는 중"
          color="#2F3A9E"
        />
      )}
      {flow.error && (
        <View style={styles.feedback} accessibilityRole="alert">
          <Text style={styles.body}>
            {flow.error.code === 'FORTUNE_UNAVAILABLE'
              ? '오늘의 운세가 아직 준비되지 않았어요'
              : '오늘의 운세를 불러오지 못했어요'}
          </Text>
          <Text style={styles.body}>
            양떼는 그대로예요. 운세만 다시 불러올 수 있어요.
          </Text>
          <Button label="운세 다시 불러오기" onPress={flow.retry} />
        </View>
      )}
    </>
  );
  return (
    <View style={styles.section}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="오늘의 운세 보기"
        disabled={blocked}
        accessibilityState={{ disabled: blocked }}
        onPress={() => {
          onVisibilityChange(true);
          setOpen(true);
        }}
        style={styles.entry}
      >
        <Text style={styles.tag}>오늘 운세</Text>
        <FortuneSheep />
      </Pressable>
      {!open && feedback}
      {open && !blocked && (
        <Modal
          transparent
          visible
          animationType="none"
          onRequestClose={close}
          statusBarTranslucent
          navigationBarTranslucent
          testID="fortune-modal"
        >
          <SafeAreaView style={styles.shade}>
            <ScrollView contentContainerStyle={styles.scroll}>
              <View style={styles.popup} accessibilityViewIsModal>
                <ScrollRod />
                <View style={styles.paper}>
                  <Text style={styles.caption} accessibilityRole="header">
                    오늘의 양 운세
                  </Text>
                  {f && (
                    <>
                      <Text style={styles.caption}>
                        {f.date.replaceAll('-', '.')} 기준
                      </Text>
                      <Text style={styles.title} accessibilityRole="header">
                        {rank ? `${rank}위` : sheepNames[f.sheep_type]}
                      </Text>
                      <Text style={styles.subtitle}>
                        {rank ? `오늘의 ${rank}등 양! ✦ · ` : ''}
                        {zodiacNames[f.zodiac]}
                      </Text>
                      <Text style={[styles.body, styles.message]}>
                        {f.message}
                      </Text>
                      <Text style={[styles.caption, styles.lucky]}>
                        행운 색 {f.lucky_color} · 행운 아이템 {f.lucky_item}
                      </Text>
                      <Text style={styles.body}>
                        작은 행동 · {f.small_action}
                      </Text>
                    </>
                  )}
                  {feedback}
                </View>
                <ScrollRod />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="오늘의 운세 닫기"
                  onPress={close}
                  style={styles.close}
                >
                  <Image
                    source={require('../../../assets/images/fortune/close.svg')}
                    style={{ width: 24, height: 24 }}
                    accessible={false}
                  />
                </Pressable>
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  section: { minWidth: 88, maxWidth: '100%', alignItems: 'center', gap: 8 },
  entry: {
    minWidth: 88,
    minHeight: 100,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tag: {
    fontFamily: theme.font,
    fontSize: 12,
    lineHeight: 20,
    fontWeight: '700',
    color: '#2F3A9E',
    backgroundColor: '#FFD66B',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  shade: { flex: 1, backgroundColor: 'rgba(30,32,99,0.45)' },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 52,
    paddingVertical: 32,
  },
  popup: {
    width: '100%',
    maxWidth: 256,
    alignSelf: 'center',
    boxShadow: '5px 5px 0 rgba(30,32,99,0.35)',
  },
  paper: {
    backgroundColor: '#FFF4D6',
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderColor: '#EADCB4',
    minHeight: 190,
    paddingHorizontal: 16,
    paddingTop: 28,
    paddingBottom: 20,
    marginVertical: -4,
    gap: 4,
  },
  title: {
    fontFamily: theme.font,
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '700',
    color: '#2F3A9E',
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: theme.font,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
    color: '#2F3A9E',
    textAlign: 'center',
  },
  body: {
    fontFamily: theme.font,
    fontSize: 12,
    lineHeight: 19,
    color: '#4A5290',
    textAlign: 'center',
  },
  caption: {
    fontFamily: theme.font,
    fontSize: 11,
    lineHeight: 18,
    color: '#4A5290',
    textAlign: 'center',
  },
  message: { marginTop: 8 },
  lucky: { marginTop: 12 },
  close: {
    position: 'absolute',
    left: -2,
    top: 10,
    width: 48,
    height: 48,
    padding: 12,
  },
  feedback: {
    width: 250,
    maxWidth: '100%',
    padding: 12,
    gap: 10,
    backgroundColor: '#FFF4D6',
  },
});

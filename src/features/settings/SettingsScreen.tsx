import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image, type ImageSource } from 'expo-image';
import { NightScreen } from '../../ui/NightScreen';
import { Button } from '../../ui/Button';
import { theme } from '../../ui/theme';
import type { SettingsActions } from './types';
import { Header } from './Header';
import { WorryListScreen } from './WorryListScreen';
import { useSettings } from './useSettings';
export function SettingsScreen(props: Parameters<typeof SettingsSession>[0]) {
  const [source, setSource] = useState({ actions: props.actions, version: 0 });
  if (source.actions !== props.actions)
    setSource({ actions: props.actions, version: source.version + 1 });
  return <SettingsSession key={source.version} {...props} />;
}
function SettingsSession({
  actions,
  onBack,
  modal = false,
}: {
  actions: SettingsActions;
  onBack: () => void;
  modal?: boolean;
}) {
  const flow = useSettings(actions);
  const [list, setList] = useState(false);
  const back = () => {
    if (list) setList(false);
    else {
      flow.cancel();
      onBack();
    }
  };
  useEffect(() => {
    if (modal) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (list) setList(false);
      else onBack();
      return true;
    });
    return () => sub.remove();
  }, [list, modal, onBack]);
  const data = flow.data;
  const content =
    list && data ? (
      <WorryListScreen
        actions={actions.worries}
        total={data.user.stats.worry_record_count}
        onBack={() => setList(false)}
      />
    ) : (
      <NightScreen
        background={require('../../../assets/images/settings/background.svg')}
      >
        <Header title="설정" backLabel="아침 홈으로 돌아가기" onBack={back} />
        <ScrollView contentContainerStyle={styles.content}>
          {!data ? (
            <View style={[styles.panel, styles.state]}>
              {flow.error ? (
                <>
                  <Text accessibilityRole="alert" style={styles.body}>
                    설정을 불러오지 못했어요.
                  </Text>
                  <Button label="설정 다시 불러오기" onPress={flow.retry} />
                </>
              ) : (
                <>
                  <ActivityIndicator color={theme.color.primary} />
                  <Text style={styles.body}>설정을 불러오고 있어요.</Text>
                </>
              )}
            </View>
          ) : (
            <>
              <View style={styles.profile}>
                <View style={styles.sheepBox}>
                  <Image
                    source={require('../../../assets/images/settings/sheep.svg')}
                    style={{
                      width: 48.0001,
                      height: 40,
                      position: 'absolute',
                      left: 4,
                      top: 10,
                    }}
                    accessible={false}
                  />
                </View>
                <View style={styles.profileText}>
                  <Text style={styles.profileTitle}>
                    {data.user.stats.night_count}밤째 양을 세는 중
                  </Text>
                  <Text style={styles.caption}>{data.user.email}</Text>
                </View>
              </View>
              <Text style={styles.section}>밤</Text>
              <View style={styles.panel}>
                <Row
                  label="밤에 와 알림"
                  icon={require('../../../assets/images/settings/reminder.svg')}
                />
              </View>
              <Text style={styles.section}>내 정보</Text>
              <View style={styles.panel}>
                <Row
                  label="생년월일"
                  icon={require('../../../assets/images/settings/birthday.svg')}
                />
                <View style={styles.divider} />
                <Row
                  label="고민 기록"
                  value={`${data.user.stats.worry_record_count}개`}
                  icon={require('../../../assets/images/settings/worry.svg')}
                  onPress={() => setList(true)}
                />
                <View style={styles.divider} />
                <Row
                  label="로그인 정보"
                  icon={require('../../../assets/images/settings/login.svg')}
                />
              </View>
              <Text style={styles.section}>기타</Text>
              <View style={styles.panel}>
                <Row
                  label="약관 · 개인정보"
                  icon={require('../../../assets/images/settings/legal.svg')}
                />
                <View style={styles.divider} />
                <Row
                  label="탈퇴"
                  icon={require('../../../assets/images/settings/withdraw.svg')}
                  destructive
                />
              </View>
            </>
          )}
        </ScrollView>
      </NightScreen>
    );
  return modal ? (
    <Modal
      visible
      animationType="none"
      onRequestClose={back}
      testID="settings-modal"
      statusBarTranslucent
      navigationBarTranslucent
    >
      <StatusBar style="light" />
      {content}
    </Modal>
  ) : (
    <>
      <StatusBar style="light" />
      {content}
    </>
  );
}
function Row({
  label,
  value,
  icon,
  onPress,
  destructive = false,
}: {
  label: string;
  value?: string;
  icon: ImageSource;
  onPress?: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={onPress ? `${label} 열기` : `${label} · 준비 중`}
      accessibilityState={{ disabled: !onPress }}
      disabled={!onPress}
      onPress={onPress}
      style={styles.row}
    >
      <Image
        source={icon}
        style={{ width: 26, height: 26 }}
        accessible={false}
      />
      <View style={styles.rowText}>
        <Text style={[styles.body, destructive && styles.destructive]}>
          {label}
        </Text>
        <Text style={styles.caption}>{onPress ? value : '준비 중'}</Text>
      </View>
      {onPress && (
        <Image
          source={require('../../../assets/images/settings/chevron.svg')}
          style={{ width: 7, height: 11 }}
          accessible={false}
        />
      )}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 10,
    flexGrow: 1,
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#2B3591',
    boxShadow: '4px 4px 0 #0E1040',
  },
  sheepBox: {
    width: 56,
    height: 56,
    backgroundColor: '#1E2063',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileText: { flex: 1, minWidth: 0, gap: 4 },
  profileTitle: {
    fontFamily: theme.font,
    color: theme.color.text,
    fontSize: 15,
    lineHeight: 24,
    fontWeight: '700',
  },
  caption: {
    fontFamily: theme.font,
    color: theme.color.muted,
    fontSize: 12,
    lineHeight: 20,
  },
  section: {
    fontFamily: theme.font,
    color: theme.color.muted,
    fontSize: 11,
    lineHeight: 18,
    marginTop: 14,
  },
  state: { padding: 16, gap: 14 },
  panel: { backgroundColor: '#2B3591', boxShadow: '4px 4px 0 #0E1040' },
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 52,
    alignItems: 'center',
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    columnGap: 8,
  },
  body: {
    fontFamily: theme.font,
    color: theme.color.text,
    fontSize: 14,
    lineHeight: 22,
    flexShrink: 1,
  },
  destructive: { color: '#F9CFDD' },
  divider: { height: 1, backgroundColor: '#3B4FB8' },
});

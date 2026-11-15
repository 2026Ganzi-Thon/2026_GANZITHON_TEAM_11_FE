import { Image } from 'expo-image';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Button } from '../../ui/Button';
import { NightScreen } from '../../ui/NightScreen';
import { theme } from '../../ui/theme';
export function WelcomeScreen({
  onSignup,
  onLogin,
}: {
  onSignup: () => void;
  onLogin: () => void;
}) {
  const { height, fontScale } = useWindowDimensions();
  const [availableHeight, setAvailableHeight] = useState(height);
  return (
    <NightScreen
      background={require('../../../assets/images/signup/welcome-background.svg')}
    >
      <View
        style={{ flex: 1 }}
        onLayout={(e) => setAvailableHeight(e.nativeEvent.layout.height)}
      >
        <ScrollView
          contentContainerStyle={[s.content, { minHeight: availableHeight }]}
        >
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[s.art, { top: fontScale > 1 ? 371 : 297 }]}
          >
            <Image
              source={require('../../../assets/images/signup/cloud-sheep.png')}
              contentFit="contain"
              style={{
                position: 'absolute',
                left: -232,
                top: 0,
                width: 504,
                height: 413,
              }}
              accessible={false}
            />
            <Image
              source={require('../../../assets/images/feed/jump-sheep.svg')}
              contentFit="contain"
              style={{
                position: 'absolute',
                left: 190,
                top: 85,
                width: 60.0001,
                height: 50,
              }}
              accessible={false}
            />
            <Image
              source={require('../../../assets/images/signup/sleep.svg')}
              contentFit="contain"
              style={{
                position: 'absolute',
                left: 249,
                top: 38.5,
                width: 90,
                height: 36,
              }}
              accessible={false}
            />
          </View>
          <View style={s.heading}>
            <Text accessibilityRole="header" style={s.title}>
              양 세는 밤
            </Text>
            <View style={s.copy}>
              <Text style={s.subtitle}>쉿! 양이 자고 있어요</Text>
              <Text style={s.subtitle}>조용히 들어와서 같이 세어봐요</Text>
            </View>
          </View>
          <View style={s.space} />
          <View style={s.buttons}>
            <Button label="이메일로 회원가입" onPress={onSignup} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="이메일로 로그인"
              onPress={onLogin}
              style={s.secondary}
            >
              <Text style={s.secondaryText}>이메일로 로그인</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </NightScreen>
  );
}
const s = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 70,
    paddingBottom: 24,
    overflow: 'hidden',
  },
  heading: { gap: 12 },
  title: {
    fontFamily: theme.font,
    fontSize: 32,
    lineHeight: 45,
    fontWeight: '700',
    color: theme.color.text,
    textAlign: 'center',
  },
  copy: { gap: 0 },
  subtitle: {
    fontFamily: theme.font,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
    color: theme.color.muted,
    textAlign: 'center',
  },
  space: { flex: 1, minHeight: 360 },
  buttons: { gap: 14 },
  secondary: {
    minHeight: 52,
    backgroundColor: '#1E2063',
    borderWidth: 1,
    borderColor: '#4A5BC2',
    borderRadius: 4,
    justifyContent: 'center',
    padding: 12,
  },
  secondaryText: {
    fontFamily: theme.font,
    color: theme.color.text,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  art: { position: 'absolute', left: 0, right: 0, height: 413 },
});

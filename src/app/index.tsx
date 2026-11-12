import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Button } from '../ui/Button';

export default function StartScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          양 세는 밤
        </Text>
        <Text style={styles.description}>잠이 안 오는 밤, 양을 같이 세요.</Text>
        {__DEV__ && (
          <>
            <Button
              label="로그인 화면 미리보기"
              onPress={() => router.push('/dev/login')}
            />
            <Button
              label="오늘 밤 화면 미리보기"
              onPress={() => router.push('/dev/night-entry')}
            />
            <Button
              label="피드 화면 미리보기"
              onPress={() => router.push('/dev/night-feed')}
            />
            <Button
              label="밤 마무리 미리보기"
              onPress={() => router.push('/dev/night-closing')}
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#242460',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  title: {
    color: '#FFF4D6',
    fontSize: 36,
    fontWeight: '700',
    textAlign: 'center',
  },
  description: {
    color: '#D5D5F4',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
});

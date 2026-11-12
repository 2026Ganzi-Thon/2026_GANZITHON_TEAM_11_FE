import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Button } from '../ui/Button';

export default function StartScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          양 세는 밤
        </Text>
        <Text style={styles.description}>잠이 안 오는 밤, 양을 같이 세요.</Text>
        {__DEV__ && (
          <>
            <Button
              label="털실 반응 미리보기"
              onPress={() => router.push('/dev/yarn')}
            />
            <Button
              label="담은 노래 미리보기"
              onPress={() => router.push('/dev/saved-songs')}
            />
            <Button
              label="밤→아침 시연"
              onPress={() => router.push('/dev/night-morning')}
            />
            <Button
              label="아침 회고 미리보기"
              onPress={() => router.push('/dev/morning-reflection')}
            />
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
            <Button
              label="아침·양떼 미리보기"
              onPress={() => router.push('/dev/morning')}
            />
            <Button
              label="양 상세 미리보기"
              onPress={() => router.push('/dev/sheep-detail')}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#242460',
  },
  content: {
    flexGrow: 1,
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

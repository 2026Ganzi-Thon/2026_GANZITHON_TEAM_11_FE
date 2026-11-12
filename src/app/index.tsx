import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function StartScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          양 세는 밤
        </Text>
        <Text style={styles.description}>잠이 안 오는 밤, 양을 같이 세요.</Text>
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

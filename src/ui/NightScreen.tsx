import type { PropsWithChildren } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from './theme';

export function NightScreen({ children }: PropsWithChildren) {
  return (
    <View style={styles.screen}>
      <Image
        source={require('../../assets/images/night-sky.svg')}
        style={StyleSheet.absoluteFill}
        contentFit="fill"
        accessible={false}
        pointerEvents="none"
      />
      <SafeAreaView style={styles.safe}>{children}</SafeAreaView>
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.background },
  safe: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' },
});

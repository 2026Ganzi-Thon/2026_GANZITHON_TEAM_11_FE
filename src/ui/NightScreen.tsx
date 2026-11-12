import type { PropsWithChildren } from 'react';
import { Image, type ImageSource } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from './theme';

export function NightScreen({
  children,
  background = require('../../assets/images/night-sky.svg'),
}: PropsWithChildren<{ background?: ImageSource | number }>) {
  return (
    <View style={styles.screen}>
      <Image
        source={background}
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

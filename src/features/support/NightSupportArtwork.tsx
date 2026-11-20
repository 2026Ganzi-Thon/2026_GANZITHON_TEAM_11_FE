import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../../ui/theme';
/** Local N-08 artwork; the message stays data-supplied and grows with system font size. */
export function NightSupportArtwork({
  message,
  error = false,
}: {
  message: string;
  error?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Image
        source={require('../../../assets/images/night-support/sheep.png')}
        style={styles.sheep}
        contentFit="contain"
        accessible={false}
      />
      <View style={styles.bubble}>
        <Image
          source={require('../../../assets/images/night-support/bubble-tail.svg')}
          style={styles.tail}
          accessible={false}
        />
        <Text
          style={styles.message}
          accessibilityRole={error ? 'alert' : undefined}
        >
          {message}
        </Text>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  sheep: { width: 42, height: 35 },
  bubble: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: '#3C47AD',
  },
  tail: {
    position: 'absolute',
    left: -12,
    top: '50%',
    width: 13,
    height: 21,
    transform: [{ translateY: -10.5 }],
  },
  message: {
    fontFamily: theme.font,
    fontSize: 16,
    lineHeight: 25,
    color: theme.color.muted,
  },
});

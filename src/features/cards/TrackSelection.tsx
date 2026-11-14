import { useState } from 'react';
import { Image } from 'expo-image';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type { Track } from '../../api/contracts';
import { theme } from '../../ui/theme';
export function TrackSelection({
  track,
  checked,
  disabled,
  onPress,
}: {
  track: Track;
  checked: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const { fontScale } = useWindowDimensions();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`${track.title} · ${track.artist}`}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.row, fontScale > 1.3 && styles.readable]}
    >
      <View style={styles.cover}>
        {track.cover_url && !failed ? (
          <Image
            source={{ uri: track.cover_url }}
            style={styles.coverImage}
            onError={() => setFailed(true)}
            accessible={false}
          />
        ) : (
          <Image
            source={require('../../../assets/images/song-card/note.svg')}
            style={styles.note}
            accessible={false}
          />
        )}
      </View>
      <View style={styles.metadata}>
        <Text style={styles.title}>{track.title}</Text>
        <Text style={styles.artist}>{track.artist}</Text>
      </View>
      {checked ? (
        <View style={styles.check}>
          <Image
            source={require('../../../assets/images/song-card/check.svg')}
            style={styles.checkIcon}
            accessible={false}
          />
        </View>
      ) : (
        <Text style={styles.select}>선택</Text>
      )}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    minHeight: 64,
  },
  readable: { backgroundColor: '#2B3591' },
  cover: {
    width: 48,
    height: 48,
    flexShrink: 0,
    backgroundColor: '#2B3591',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '4px 4px 0 #0E1040',
  },
  coverImage: { width: 48, height: 48 },
  note: { width: 20, height: 20 },
  metadata: { flex: 1, gap: 2 },
  title: {
    fontFamily: theme.font,
    color: theme.color.text,
    fontWeight: '700',
    fontSize: 15,
    lineHeight: 23,
  },
  artist: {
    fontFamily: theme.font,
    color: theme.color.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  select: {
    fontFamily: theme.font,
    color: theme.color.text,
    fontWeight: '700',
    fontSize: 13,
    lineHeight: 20,
  },
  check: {
    width: 24,
    height: 24,
    backgroundColor: theme.color.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkIcon: { width: 14, height: 14 },
});

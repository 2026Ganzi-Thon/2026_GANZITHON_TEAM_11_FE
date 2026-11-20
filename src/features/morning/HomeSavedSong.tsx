import { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../ui/theme';
import type { SavedSong, SongActions } from '../songs/types';
export function HomeSavedSong({
  actions,
  paused,
  onOpen,
}: {
  actions: SongActions;
  paused: boolean;
  onOpen: () => void;
}) {
  const [result, setResult] = useState<{
    song: SavedSong | null;
    failed: boolean;
  }>({ song: null, failed: false });
  const { song, failed } = result;
  useEffect(() => {
    if (paused) return;
    const request = new AbortController();
    void actions
      .load(request.signal)
      .then((items) => {
        if (!request.signal.aborted)
          setResult({ song: items[0] ?? null, failed: false });
      })
      .catch(() => {
        if (!request.signal.aborted) setResult({ song: null, failed: true });
      });
    return () => request.abort();
  }, [actions, paused]);
  if (failed)
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="담은 노래 확인하기"
        onPress={onOpen}
        style={styles.panel}
      >
        <Text style={styles.title}>
          담은 노래를 확인하지 못했어요. 목록에서 다시 확인해 주세요.
        </Text>
      </Pressable>
    );
  if (!song) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="어젯밤 담은 노래 열기"
      onPress={onOpen}
      style={styles.panel}
    >
      <Image
        source={require('../../../assets/images/songs/record.svg')}
        contentFit="contain"
        style={{ width: 38, height: 38 }}
        accessible={false}
      />
      <View style={styles.info}>
        <Text style={styles.caption}>어젯밤 담은 노래</Text>
        <Text style={styles.title}>
          {song.track.title} · {song.track.artist}
        </Text>
      </View>
      <Text style={styles.link}>목록</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  panel: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 2,
    borderColor: '#2F3A9E',
    backgroundColor: '#FFFFFF',
    padding: 6,
    minHeight: 56,
    boxShadow: '4px 4px 0 #AFC0FF',
  },
  info: { flex: 1, gap: 2 },
  caption: {
    fontFamily: theme.font,
    fontSize: 14,
    lineHeight: 21,
    color: '#4A5290',
  },
  title: {
    fontFamily: theme.font,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    color: '#2F3A9E',
  },
  link: {
    fontFamily: theme.font,
    fontSize: 14,
    lineHeight: 22,
    color: '#2F3A9E',
    fontWeight: '700',
  },
});

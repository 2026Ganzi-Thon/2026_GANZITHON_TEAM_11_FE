import { useState } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import type { Track } from '../../../api/contracts';
import { Art } from './artwork';

export function SongArtwork({ track }: { track: Track }) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={styles.frame}>
      <Art
        source={require('../../../../assets/images/feed/record.svg')}
        x={70}
        y={0}
        width={132}
        height={132}
      />
      <Art
        source={require('../../../../assets/images/feed/album-shadow.svg')}
        x={5}
        y={5}
        width={132}
        height={132}
      />
      <Art
        source={require('../../../../assets/images/feed/album-border.svg')}
        x={0}
        y={0}
        width={132}
        height={132}
      />
      {track.cover_url && !failed ? (
        <Image
          accessibilityLabel={`${track.title} 앨범 표지`}
          accessible
          source={{ uri: track.cover_url }}
          style={styles.cover}
          contentFit="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <View
          accessible
          accessibilityLabel="앨범 표지 없음"
          style={styles.fallback}
        >
          <Art
            source={require('../../../../assets/images/feed/album.svg')}
            x={2}
            y={2}
            width={128}
            height={128}
          />
          <View style={styles.sky} />
          <View style={styles.hill} />
          <Art
            source={require('../../../../assets/images/feed/album-stars.svg')}
            x={16}
            y={10}
            width={93}
            height={39}
          />
          <Art
            source={require('../../../../assets/images/feed/album-moon.svg')}
            x={96}
            y={12}
            width={20}
            height={20}
          />
          <Art
            source={require('../../../../assets/images/feed/jump-sheep.svg')}
            x={30}
            y={72}
            width={66}
            height={55}
          />
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  frame: { position: 'absolute', top: 50, left: 58, width: 202, height: 137 },
  cover: { position: 'absolute', left: 2, top: 2, width: 128, height: 128 },
  fallback: { width: 132, height: 132 },
  sky: {
    position: 'absolute',
    left: 2,
    top: 2,
    width: 128,
    height: 62,
    backgroundColor: '#242565',
  },
  hill: {
    position: 'absolute',
    left: 2,
    top: 100,
    width: 128,
    height: 30,
    backgroundColor: '#172066',
  },
});

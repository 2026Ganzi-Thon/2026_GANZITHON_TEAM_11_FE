import { StyleSheet, View } from 'react-native';
import { Art } from '../feed/artwork';
export function ClosingArtwork({ offer = false }: { offer?: boolean }) {
  return (
    <View
      style={[styles.art, { height: offer ? 280 : 260 }]}
      pointerEvents="none"
      accessible={false}
    >
      {offer ? (
        <>
          <Art
            source={require('../../../../assets/images/closing/envelope.svg')}
            x={71}
            y={88}
            width={187}
            height={131}
          />
          <Art
            source={require('../../../../assets/images/closing/sparkles.svg')}
            x={40}
            y={40}
            width={264}
            height={200}
          />
        </>
      ) : (
        <>
          <View style={styles.ground} />
          {[128, 144, 160, 176, 192].map((left) => (
            <View key={left} style={[styles.post, { left }]} />
          ))}
          <View style={[styles.rail, { top: 214 }]} />
          <View style={[styles.rail, { top: 230 }]} />
          <View style={styles.jumper}>
            <Art
              source={require('../../../../assets/images/feed/jump-sheep.svg')}
              x={0}
              y={0}
              width={60}
              height={50}
            />
          </View>
          <Art
            source={require('../../../../assets/images/feed/left-sheep.svg')}
            x={30}
            y={200}
            width={60}
            height={50}
          />
          <Art
            source={require('../../../../assets/images/feed/right-sheep.svg')}
            x={250}
            y={208}
            width={48}
            height={40}
          />
        </>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  art: { width: 320, alignSelf: 'center' },
  ground: {
    position: 'absolute',
    left: 0,
    top: 248,
    width: 320,
    height: 2,
    backgroundColor: '#4A55B8',
  },
  post: {
    position: 'absolute',
    top: 206,
    width: 6,
    height: 42,
    borderRadius: 2,
    backgroundColor: '#4A55B8',
  },
  rail: {
    position: 'absolute',
    left: 124,
    width: 80,
    height: 4,
    backgroundColor: '#4A55B8',
  },
  jumper: {
    position: 'absolute',
    left: 135.2,
    top: 160.8,
    width: 60,
    height: 50,
    transform: [{ rotate: '10deg' }],
  },
});

import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
export function NightReturnArtwork() {
  return (
    <View style={styles.art} accessible={false} pointerEvents="none">
      <Image
        source={require('../../../../assets/images/night-return/cloud-sheep.svg')}
        style={styles.cloudSheep}
        contentFit="contain"
      />
      <Image
        source={require('../../../../assets/images/night-return/sheep.svg')}
        style={styles.sheep}
        contentFit="contain"
      />
      <Image
        source={require('../../../../assets/images/night-return/moon.svg')}
        style={styles.moon}
        contentFit="contain"
      />
      <Image
        source={require('../../../../assets/images/night-return/cloud.svg')}
        style={styles.cloud}
        contentFit="contain"
      />
    </View>
  );
}
const styles = StyleSheet.create({
  art: { width: 318, height: 190, alignSelf: 'center' },
  cloudSheep: {
    position: 'absolute',
    left: 76,
    top: 37,
    width: 190,
    height: 153,
  },
  sheep: { position: 'absolute', left: 132, top: 7, width: 48, height: 40 },
  moon: { position: 'absolute', left: 270, top: 2, width: 21, height: 27 },
  cloud: { position: 'absolute', left: 276, top: 20, width: 30, height: 12 },
});

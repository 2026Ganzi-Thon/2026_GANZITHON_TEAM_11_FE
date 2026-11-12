import { Image, type ImageSource } from 'expo-image';
import { StyleSheet, View } from 'react-native';

export function Art({
  source,
  x,
  y,
  width,
  height,
}: {
  source: ImageSource | number;
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  return (
    <Image
      source={source}
      style={{ position: 'absolute', left: x, top: y, width, height }}
      contentFit="fill"
      accessible={false}
    />
  );
}
export function PaperArtwork({
  kind,
}: {
  kind: 'paper' | 'jacket' | 'postcard';
}) {
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessible={false}
    >
      <Art
        source={require('../../../../assets/images/feed/paper-shadow.svg')}
        x={6}
        y={6}
        width={318}
        height={470}
      />
      <Art
        source={
          kind === 'jacket'
            ? require('../../../../assets/images/feed/jacket-border.svg')
            : kind === 'postcard'
              ? require('../../../../assets/images/feed/postcard-border.svg')
              : require('../../../../assets/images/feed/paper-border.svg')
        }
        x={0}
        y={0}
        width={318}
        height={470}
      />
      <Art
        source={
          kind === 'jacket'
            ? require('../../../../assets/images/feed/jacket.svg')
            : kind === 'postcard'
              ? require('../../../../assets/images/feed/postcard.svg')
              : require('../../../../assets/images/feed/paper.svg')
        }
        x={2}
        y={2}
        width={314}
        height={466}
      />
      {kind === 'paper' && (
        <>
          <Art
            source={require('../../../../assets/images/feed/paper-grain-a.svg')}
            x={6}
            y={6}
            width={304}
            height={446}
          />
          <Art
            source={require('../../../../assets/images/feed/paper-grain-b.svg')}
            x={10}
            y={10}
            width={298}
            height={452}
          />
          <Art
            source={require('../../../../assets/images/feed/paper-grain-c.svg')}
            x={22}
            y={8}
            width={270}
            height={454}
          />
          <View
            style={{
              position: 'absolute',
              left: 119,
              top: -10,
              width: 80,
              height: 22,
              backgroundColor: 'rgba(214,168,255,0.6)',
            }}
          />
        </>
      )}
      {kind === 'postcard' && (
        <>
          <Art
            source={require('../../../../assets/images/feed/postcard-grain-a.svg')}
            x={8}
            y={8}
            width={294}
            height={452}
          />
          <Art
            source={require('../../../../assets/images/feed/postcard-grain-b.svg')}
            x={6}
            y={78}
            width={302}
            height={382}
          />
        </>
      )}
    </View>
  );
}
export function SleepingSheep() {
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessible={false}
    >
      <Art
        source={require('../../../../assets/images/feed/warm-stars.svg')}
        x={40}
        y={24}
        width={251}
        height={193}
      />
      <Art
        source={require('../../../../assets/images/feed/warm-crosses.svg')}
        x={214}
        y={30}
        width={60}
        height={163}
      />
      <Art
        source={require('../../../../assets/images/feed/sleep-shadow.svg')}
        x={31}
        y={253}
        width={180}
        height={138}
      />
      <Art
        source={require('../../../../assets/images/feed/sleep-wool.svg')}
        x={26}
        y={248}
        width={180}
        height={138}
      />
      <Art
        source={require('../../../../assets/images/feed/sleep-head.svg')}
        x={170}
        y={306}
        width={56}
        height={46}
      />
      <Art
        source={require('../../../../assets/images/feed/sleep-eyes.svg')}
        x={185}
        y={328}
        width={26}
        height={3}
      />
      <Art
        source={require('../../../../assets/images/feed/sleep-zz.svg')}
        x={222}
        y={266}
        width={42}
        height={18}
      />
    </View>
  );
}

import { Image } from 'expo-image';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { WorryCategory } from './categories';
import { theme } from '../../ui/theme';

export function WorryPaper({
  category,
  value,
  limit,
  disabled,
  onChange,
}: {
  category?: WorryCategory;
  value: string;
  limit: number;
  disabled: boolean;
  onChange: (text: string) => void;
}) {
  const noWorry = category?.id === 'none';
  return (
    <View style={styles.paper}>
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        accessible={false}
      >
        <Image
          source={require('../../../assets/images/night-entry/paper-shadow.svg')}
          style={[styles.full, { left: 6, top: 6 }]}
          contentFit="fill"
        />
        <Image
          source={require('../../../assets/images/night-entry/paper.svg')}
          style={styles.full}
          contentFit="fill"
        />
        <Image
          source={require('../../../assets/images/night-entry/paper-specks-light.svg')}
          style={styles.light}
          contentFit="fill"
        />
        <Image
          source={require('../../../assets/images/night-entry/paper-specks-sand.svg')}
          style={styles.sand}
          contentFit="fill"
        />
        <Image
          source={require('../../../assets/images/night-entry/paper-specks-white.svg')}
          style={styles.white}
          contentFit="fill"
        />
        <Image
          source={require('../../../assets/images/night-entry/paper-border.svg')}
          style={styles.full}
          contentFit="fill"
        />
        <View style={styles.bookmark}>
          <Image
            source={require('../../../assets/images/night-entry/bookmark.svg')}
            style={StyleSheet.absoluteFill}
            tintColor={category?.color ?? '#D3D8F2'}
            contentFit="fill"
          />
          <Text style={styles.ribbonText}>
            {category?.label.replaceAll(' ', '').split('').join('\n')}
          </Text>
        </View>
      </View>
      <TextInput
        accessibilityLabel="오늘의 고민"
        multiline
        textAlignVertical="top"
        editable={!!category && !noWorry && !disabled}
        value={noWorry ? '' : value}
        onChangeText={onChange}
        placeholder={
          !category
            ? '책을 고르면 여기에 적을 수 있어요'
            : noWorry
              ? '오늘은 고민 없이 쉬어가요'
              : '마음에 남은 고민을 한두 줄 적어 주세요'
        }
        placeholderTextColor="#8C6E62"
        style={styles.input}
        autoCorrect={false}
        autoComplete="off"
      />
      <Text style={styles.counter}>
        {noWorry ? 0 : value.length} / {limit}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  paper: { height: 196, marginRight: 6 },
  full: { position: 'absolute', width: '100%', height: '100%' },
  light: {
    position: 'absolute',
    top: 6,
    left: '1.875%',
    width: '95.625%',
    height: 182,
  },
  sand: {
    position: 'absolute',
    top: 8,
    left: '6.875%',
    width: '86.875%',
    height: 172,
  },
  white: {
    position: 'absolute',
    top: 6,
    left: '23.75%',
    width: '64.375%',
    height: 180,
  },
  bookmark: { position: 'absolute', top: -8, right: 14, width: 24, height: 92 },
  ribbonText: {
    marginTop: 14,
    textAlign: 'center',
    fontFamily: theme.font,
    fontWeight: '700',
    color: theme.color.background,
    fontSize: 12,
    lineHeight: 14,
    includeFontPadding: false,
  },
  input: {
    flex: 1,
    marginLeft: 18,
    marginRight: 46,
    marginTop: 16,
    marginBottom: 6,
    padding: 0,
    fontFamily: theme.font,
    color: theme.color.background,
    fontSize: 15,
    lineHeight: 24,
    includeFontPadding: false,
  },
  counter: {
    textAlign: 'right',
    marginRight: 16,
    marginBottom: 14,
    fontFamily: theme.font,
    fontSize: 12,
    lineHeight: 18,
    includeFontPadding: false,
    color: '#8C6E62',
  },
});

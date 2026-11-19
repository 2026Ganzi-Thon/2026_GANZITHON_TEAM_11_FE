import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { FirstNightArtwork } from '../home/FirstNightArtwork';
import { DecoratedSheepArt } from '../decoration/DecoratedSheepArt';
import { theme } from '../../ui/theme';
import type { Sheep } from './types';
export function MorningPasture({
  items,
  lastNightId,
  newId,
  onSelect,
  onDecorate,
  fortune,
}: {
  items: Sheep[];
  lastNightId?: string;
  newId: string | null;
  onSelect?: (id: string) => void;
  onDecorate?: () => void;
  fortune?: ReactNode;
}) {
  const { width, fontScale } = useWindowDimensions(),
    scale = Math.min(width, 480) / 360;
  const cells: ReactNode[] = items.map((item, index) => (
    <View
      key={item.id}
      style={[styles.cell, { paddingTop: index % 2 === 0 ? 10 : 0 }]}
    >
      <Pressable
        accessible
        accessibilityRole={onSelect ? 'button' : undefined}
        disabled={!onSelect}
        onPress={() => onSelect?.(item.id)}
        accessibilityLabel={`${item.night_date}의 양${item.id === newId ? ' · 새로 온 양' : ''}${item.placements?.length ? ` · 스티커 ${item.placements.length}개` : ''}`}
        style={[styles.sheep, item.id === newId && styles.newSheep]}
      >
        {item.night_id === lastNightId && (
          <Text style={styles.badge}>어젯밤</Text>
        )}
        <DecoratedSheepArt sheep={item} />
      </Pressable>
    </View>
  ));
  if (fortune)
    cells.splice(
      Math.min(6, cells.length),
      0,
      <View key="fortune" style={styles.cell}>
        {fortune}
      </View>,
    );
  return (
    <View style={[styles.scene, { minHeight: 316 * scale }]}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 416 * scale,
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#73AE8A',
        }}
      />
      <FirstNightArtwork scale={scale} pasture />
      {onDecorate && (
        <View style={[styles.signArea, { marginLeft: 70 * scale }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="양 꾸미기"
            onPress={onDecorate}
            style={styles.sign}
          >
            <Text style={styles.signLabel}>양 꾸미기</Text>
          </Pressable>
          <View style={styles.post} />
        </View>
      )}
      <View
        style={[
          styles.grid,
          { paddingTop: onDecorate ? 32 : 110 * scale },
          fontScale > 1.3 && { rowGap: 16 },
        ]}
      >
        {cells}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  scene: {
    backgroundColor: 'transparent',
    paddingBottom: 20,
    overflow: 'hidden',
  },
  signArea: { alignItems: 'center', alignSelf: 'flex-start', paddingTop: 22 },
  sign: {
    backgroundColor: '#F4EBDD',
    borderWidth: 2,
    borderColor: '#8C6E62',
    paddingHorizontal: 8,
    paddingVertical: 6,
    minHeight: 44,
    justifyContent: 'center',
    boxShadow: '2px 2px 0 #5A443B',
  },
  signLabel: {
    fontFamily: theme.font,
    fontSize: 11,
    lineHeight: 17,
    fontWeight: '700',
    color: '#5A443B',
  },
  post: { width: 5, height: 12, backgroundColor: '#8C6E62' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    paddingHorizontal: 16,
    rowGap: 4,
  },
  cell: {
    width: '25%',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  sheep: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    gap: 3,
  },
  newSheep: {
    backgroundColor: 'rgba(255,231,163,0.65)',
    borderWidth: 2,
    borderColor: '#FFE7A3',
  },
  badge: {
    fontFamily: theme.font,
    fontSize: 9,
    lineHeight: 14,
    paddingHorizontal: 4,
    backgroundColor: '#FFFFFF',
    color: '#2F3A9E',
    textAlign: 'center',
  },
});

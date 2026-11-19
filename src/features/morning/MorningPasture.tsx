import { useEffect, useState, type ReactNode } from 'react';
import { SheepArrival } from './SheepArrival';
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
  arrival,
  onSheepLayout,
  layoutKey = 'static',
}: {
  items: Sheep[];
  lastNightId?: string;
  newId: string | null;
  onSelect?: (id: string) => void;
  onDecorate?: () => void;
  fortune?: ReactNode;
  arrival?: { ready: boolean; reducedMotion: boolean };
  onSheepLayout?: (y: number) => void;
  layoutKey?: string;
}) {
  const { width, fontScale } = useWindowDimensions(),
    scale = Math.min(width, 480) / 360;
  const [gridY, setGridY] = useState<number | null>(null);
  const [cell, setCell] = useState<{ key: string; y: number } | null>(null);
  useEffect(() => {
    if (gridY !== null && cell?.key === layoutKey)
      onSheepLayout?.(gridY + cell.y);
  }, [gridY, cell, layoutKey, onSheepLayout]);
  const cells: ReactNode[] = items.map((item, index) => (
    <View
      key={item.id === newId ? `${item.id}:${layoutKey}` : item.id}
      testID={item.id === newId ? 'arriving-sheep-cell' : undefined}
      onLayout={
        item.id === newId
          ? (event) =>
              setCell({ key: layoutKey, y: event.nativeEvent.layout.y })
          : undefined
      }
      style={[styles.cell, { paddingTop: index % 2 === 0 ? 10 : 0 }]}
    >
      <SheepArrival
        active={item.id === newId && !!arrival}
        ready={arrival?.ready ?? true}
        reducedMotion={arrival?.reducedMotion ?? true}
        scale={scale}
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
      </SheepArrival>
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
            <View style={styles.board}>
              <Text style={styles.signLabel}>양 꾸미기</Text>
            </View>
          </Pressable>
          <View
            style={[
              styles.post,
              fontScale > 1.3 && { marginTop: 0, height: 12 },
            ]}
          />
        </View>
      )}
      <View
        testID="morning-flock-grid"
        onLayout={(event) => setGridY(event.nativeEvent.layout.y)}
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
  signArea: { alignItems: 'center', alignSelf: 'flex-start', paddingTop: 26 },
  sign: { minHeight: 44, justifyContent: 'center' },
  board: {
    backgroundColor: '#F4EBDD',
    borderWidth: 2,
    borderColor: '#8C6E62',
    paddingHorizontal: 8,
    paddingVertical: 2,
    boxShadow: '2px 2px 0 #5A443B',
  },
  signLabel: {
    fontFamily: theme.font,
    fontSize: 11,
    lineHeight: 17,
    fontWeight: '700',
    color: '#5A443B',
  },
  post: { width: 5, height: 22, marginTop: -10, backgroundColor: '#8C6E62' },
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
    backgroundColor: '#2F3A9E',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});

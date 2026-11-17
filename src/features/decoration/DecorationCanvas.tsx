import { dropCoordinates } from './model';
import {
  type ComponentRef,
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Placement, Sticker } from './types';
import { DecoratedSheepArt } from './DecoratedSheepArt';
import { StickerArt } from './StickerArt';
import { DragItem } from './DragItem';
import type { Sheep } from '../morning/types';
export interface CanvasHandle {
  drop(id: string, x: number, y: number): void;
  preview(id: string, x: number, y: number): void;
  clear(): void;
}
export const DecorationCanvas = forwardRef<
  CanvasHandle,
  {
    sheep: Sheep;
    stickers: Sticker[];
    placements: Placement[];
    selected: string | null;
    disabled: boolean;
    failed: Set<string>;
    onSelect: (id: string) => void;
    onChange: (id: string, patch: Partial<Placement>) => void;
    onAdd: (id: string, x: number, y: number) => void;
    onDrag: (dragging: boolean) => void;
    onAssetError: (id: string) => void;
  }
>(function DecorationCanvas(
  {
    sheep,
    stickers,
    placements,
    selected,
    disabled,
    failed,
    onSelect,
    onChange,
    onAdd,
    onDrag,
    onAssetError,
  },
  ref,
) {
  const stage = useRef<ComponentRef<typeof View>>(null),
    start = useRef({ x: 0, y: 0 });
  const [ghost, setGhost] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const point = (x: number, y: number, done: (x: number, y: number) => void) =>
    stage.current?.measureInWindow((left, top, width) => {
      const result = dropCoordinates(x, y, { left, top, width });
      if (result) done(result.x, result.y);
      else setGhost(null);
    });
  useImperativeHandle(ref, () => ({
    drop: (id, x, y) => {
      setGhost(null);
      if (!disabled && !failed.has(id)) point(x, y, (x, y) => onAdd(id, x, y));
    },
    preview: (id, x, y) => {
      if (!disabled) point(x, y, (x, y) => setGhost({ id, x, y }));
    },
    clear: () => setGhost(null),
  }));
  const glyph = (p: Placement, index: number, preview = false) => {
    const st = stickers.find((s) => s.id === p.sticker_id);
    if (!st) return null;
    return (
      <View
        key={p.instance_id}
        style={{
          position: 'absolute',
          left: '50%',
          marginLeft: p.x * 130 - 65 - 22,
          top: 52 + p.y * 103 - 22,
          width: 44,
          height: 44,
        }}
      >
        <DragItem
          disabled={disabled || preview || failed.has(st.id)}
          onStart={() => {
            start.current = { x: p.x, y: p.y };
            onSelect(p.instance_id);
            onDrag(true);
          }}
          onMove={(g) =>
            onChange(p.instance_id, {
              x: start.current.x + g.dx / 130,
              y: start.current.y + g.dy / 103,
            })
          }
          onDrop={() => onDrag(false)}
          onCancel={() => onDrag(false)}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`붙인 ${st.label} ${index + 1} 선택`}
            accessibilityState={{
              selected: selected === p.instance_id,
              disabled,
            }}
            disabled={disabled || preview}
            onPress={() => onSelect(p.instance_id)}
            style={[
              styles.hit,
              selected === p.instance_id && !preview && styles.selected,
              preview && { opacity: 0.7 },
            ]}
          >
            <View
              style={{
                width: 22,
                height: 22,
                transform: [{ rotate: `${p.rotation}deg` }, { scale: p.scale }],
              }}
            >
              <StickerArt
                shape={st.asset_key}
                onError={() => onAssetError(st.id)}
              />
            </View>
          </Pressable>
        </DragItem>
      </View>
    );
  };
  return (
    <View
      ref={stage}
      collapsable={false}
      testID="decoration-stage"
      style={styles.stage}
    >
      <View style={{ position: 'absolute', alignSelf: 'center', top: 52 }}>
        <DecoratedSheepArt sheep={sheep} editor />
      </View>
      <>
        {placements.map((p, i) => glyph(p, i))}
        {ghost &&
          glyph(
            {
              instance_id: 'ghost',
              sticker_id: ghost.id,
              x: ghost.x,
              y: ghost.y,
              rotation: 0,
              scale: 1,
            },
            0,
            true,
          )}
      </>
    </View>
  );
});
const styles = StyleSheet.create({
  stage: { height: 190, width: '100%', overflow: 'hidden' },
  hit: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: {
    borderWidth: 1,
    borderColor: '#2F3A9E',
    borderStyle: 'dashed',
    backgroundColor: '#FFFFFF40',
  },
});

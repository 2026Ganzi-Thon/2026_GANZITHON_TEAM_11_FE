import { useLayoutEffect, useState, useRef, type ReactNode } from 'react';
import {
  PanResponder,
  View,
  type PanResponderGestureState,
} from 'react-native';
export function DragItem({
  disabled,
  onStart,
  onMove,
  onDrop,
  onCancel,
  children,
}: {
  disabled: boolean;
  onStart: () => void;
  onMove?: (g: PanResponderGestureState) => void;
  onDrop: (g: PanResponderGestureState) => void;
  onCancel: () => void;
  children: ReactNode;
}) {
  const latest = useRef({ disabled, onStart, onMove, onDrop, onCancel });
  useLayoutEffect(() => {
    latest.current = { disabled, onStart, onMove, onDrop, onCancel };
  });
  /* eslint-disable react-hooks/refs -- PanResponder only stores callbacks; refs are read by native events. */
  const [responder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        !latest.current.disabled && Math.abs(g.dx) + Math.abs(g.dy) > 5,
      onPanResponderGrant: () => latest.current.onStart(),
      onPanResponderMove: (_, g) => latest.current.onMove?.(g),
      onPanResponderRelease: (_, g) => latest.current.onDrop(g),
      onPanResponderTerminate: () => latest.current.onCancel(),
      onPanResponderTerminationRequest: () => false,
    }),
  );
  /* eslint-enable react-hooks/refs */
  return <View {...responder.panHandlers}>{children}</View>;
}

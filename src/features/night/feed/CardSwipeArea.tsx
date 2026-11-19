import { useCallback, useMemo, useRef, type ReactNode } from 'react';
import { PanResponder, View } from 'react-native';
import { swipeDirection } from './model';
export function CardSwipeArea({
  children,
  onMove,
  canMove,
  disabled,
}: {
  children: ReactNode;
  onMove: (direction: -1 | 1) => void;
  canMove: (direction: -1 | 1) => boolean;
  disabled: boolean;
}) {
  const captured = useRef<{ dx: number; dy: number; granted: boolean } | null>(
    null,
  );
  const capture = useCallback(
    (_event: unknown, g: { dx: number; dy: number }) => {
      if (captured.current?.granted) return false;
      const direction = swipeDirection(g.dx, g.dy);
      if (disabled || !direction || !canMove(direction)) return false;
      captured.current = { dx: g.dx, dy: g.dy, granted: false };
      return true;
    },
    [disabled, canMove],
  );
  const grant = useCallback(() => {
    if (captured.current) captured.current.granted = true;
  }, []);
  const release = useCallback(
    (_event: unknown, g: { dx: number; dy: number }) => {
      const start = captured.current;
      captured.current = null;
      if (!start?.granted) return;
      // Grant resets PanResponder deltas, so retain the displacement before capture.
      const direction = swipeDirection(start.dx + g.dx, start.dy + g.dy);
      if (!disabled && direction && canMove(direction)) onMove(direction);
    },
    [disabled, canMove, onMove],
  );
  const terminate = useCallback(() => {
    captured.current = null;
  }, []);
  const responder = useMemo(
    () =>
      // PanResponder stores these callbacks; ref reads occur only on gesture events.
      // eslint-disable-next-line react-hooks/refs
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponderCapture: capture,
        onPanResponderGrant: grant,
        onPanResponderReject: terminate,
        onPanResponderRelease: release,
        onPanResponderTerminate: terminate,
        onPanResponderTerminationRequest: () => true,
      }),
    [capture, grant, release, terminate],
  );
  return (
    <View testID="feed-card-swipe" {...responder.panHandlers}>
      {children}
    </View>
  );
}

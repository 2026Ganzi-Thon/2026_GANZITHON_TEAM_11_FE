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
  const captured = useRef<-1 | 0 | 1>(0);
  const capture = useCallback(
    (_event: unknown, g: { dx: number; dy: number }) => {
      const direction = swipeDirection(g.dx, g.dy);
      if (disabled || !direction || !canMove(direction)) return false;
      captured.current = direction;
      return true;
    },
    [disabled, canMove],
  );
  const release = useCallback(() => {
    const direction = captured.current;
    captured.current = 0;
    if (!disabled && direction && canMove(direction)) onMove(direction);
  }, [disabled, canMove, onMove]);
  const terminate = useCallback(() => {
    captured.current = 0;
  }, []);
  const responder = useMemo(
    () =>
      // PanResponder stores these callbacks; ref reads occur only on gesture events.
      // eslint-disable-next-line react-hooks/refs
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponderCapture: capture,
        onPanResponderRelease: release,
        onPanResponderTerminate: terminate,
        onPanResponderTerminationRequest: () => true,
      }),
    [capture, release, terminate],
  );
  return (
    <View testID="feed-card-swipe" {...responder.panHandlers}>
      {children}
    </View>
  );
}

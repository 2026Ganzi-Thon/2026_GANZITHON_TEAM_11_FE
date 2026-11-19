import { useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  AccessibilityInfo,
  AppState,
  ScrollView,
  type LayoutChangeEvent,
} from 'react-native';

export function useSheepArrival(id: string | null, enabled: boolean) {
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const [reduced, setReduced] = useState(true);
  const [pastureY, setPastureY] = useState<number | null>(null);
  const [sheepY, setSheepY] = useState<number | null>(null);
  const [contentReady, setContentReady] = useState(false);
  const [readyId, setReadyId] = useState<string | null>(null);
  const [skippedId, setSkippedId] = useState<string | null>(null);
  const revealed = useRef<string | null>(null);
  useEffect(() => {
    if (!id) return;
    const settle = () => {
      revealed.current = id;
      setSkippedId(id);
      setReadyId(id);
    };
    if (
      AppState.currentState === 'background' ||
      AppState.currentState === 'inactive'
    )
      settle();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') settle();
    });
    return () => subscription.remove();
  }, [id]);
  useEffect(() => {
    let disposed = false,
      changed = false;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (!disposed && !changed) setReduced(value);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (value) => {
        changed = true;
        setReduced(value);
      },
    );
    return () => {
      disposed = true;
      subscription.remove();
    };
  }, []);
  useEffect(() => {
    if (
      !id ||
      !enabled ||
      pastureY === null ||
      sheepY === null ||
      !contentReady ||
      revealed.current === id
    )
      return;
    const frame = requestAnimationFrame(() => {
      if (revealed.current === id) return;
      revealed.current = id;
      scrollRef.current?.scrollTo({
        y: Math.max(0, pastureY + sheepY - 100),
        animated: false,
      });
      setReadyId(id);
    });
    return () => cancelAnimationFrame(frame);
  }, [id, enabled, pastureY, sheepY, contentReady]);
  return {
    scrollRef,
    onPastureLayout: (event: LayoutChangeEvent) =>
      setPastureY(event.nativeEvent.layout.y),
    onSheepLayout: setSheepY,
    onContentSizeChange: () => setContentReady(true),
    onScrollBeginDrag: () => {
      if (!id) return;
      revealed.current = id;
      setSkippedId(id);
      setReadyId(id);
    },
    ready: enabled && readyId === id,
    reducedMotion: reduced || skippedId === id,
  };
}

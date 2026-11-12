import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { SongActions } from './types';
import { theme } from '../../ui/theme';
export function SongSaveButton(props: {
  cardId: string;
  saved: boolean;
  actions: SongActions;
}) {
  return <SaveControl key={props.cardId} {...props} />;
}
function SaveControl({
  cardId,
  saved,
  actions,
}: {
  cardId: string;
  saved: boolean;
  actions: SongActions;
}) {
  const [state, setState] = useState({
    api: actions,
    value: saved,
    busy: false,
    notice: '',
    failure: false,
  });
  const current =
    state.api === actions
      ? state
      : { api: actions, value: saved, busy: false, notice: '', failure: false };
  const { value, busy, notice, failure } = current;
  const active = useRef<AbortController | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      active.current?.abort();
      active.current = null;
    };
  }, [actions]);
  const change = async () => {
    if (active.current || !alive.current) return;
    const controller = new AbortController();
    active.current = controller;
    setState({ api: actions, value, busy: true, notice: '', failure: false });
    const target = !value;
    try {
      const confirmed = await actions.set(cardId, target, controller.signal);
      if (controller.signal.aborted || !alive.current) return;
      if (confirmed !== target) throw new Error('Unexpected song state');
      setState({
        api: actions,
        value: confirmed,
        busy: false,
        notice: confirmed ? '노래를 담았어요.' : '담기를 취소했어요.',
        failure: false,
      });
    } catch {
      if (!controller.signal.aborted && alive.current) {
        setState({
          api: actions,
          value,
          busy: false,
          notice: '변경하지 못했어요. 다시 시도해 주세요.',
          failure: true,
        });
      }
    } finally {
      if (active.current === controller) active.current = null;
    }
  };
  return (
    <View style={styles.panel}>
      {notice ? (
        <Text
          accessibilityRole={failure ? 'alert' : undefined}
          accessibilityLiveRegion="polite"
          style={styles.text}
        >
          {notice}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={value ? '노래 담기 취소' : '노래 담기'}
        accessibilityState={{ disabled: busy, selected: value }}
        disabled={busy}
        onPress={() => void change()}
        style={styles.button}
      >
        <Text style={styles.text}>
          {busy ? '변경 중…' : value ? '담은 노래 · 담기 취소' : '노래 담기'}
        </Text>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  panel: {
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
    padding: 12,
    gap: 8,
  },
  button: {
    padding: 12,
    minHeight: 48,
    backgroundColor: '#FFE7A3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontFamily: theme.font,
    fontSize: 13,
    lineHeight: 22,
    color: '#2F3A9E',
  },
});

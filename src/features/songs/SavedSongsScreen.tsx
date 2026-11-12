import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { DayScreen } from '../morning/DayScreen';
import { theme } from '../../ui/theme';
import type { SavedSong, SongActions, SongExternalActions } from './types';
export function SavedSongsScreen({
  actions,
  external,
  onBack,
}: {
  actions: SongActions;
  external: SongExternalActions;
  onBack: () => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    api: SongActions;
    attempt: number;
    items: SavedSong[];
    error: boolean;
  } | null>(null);
  const controller = useRef<AbortController | null>(null);
  const closed = useRef(false);
  useEffect(() => {
    closed.current = false;
    const request = new AbortController();
    controller.current = request;
    void actions
      .load(request.signal)
      .then((items) => {
        if (!request.signal.aborted)
          setState({
            api: actions,
            attempt,
            items: [
              ...new Map(items.map((item) => [item.card_id, item])).values(),
            ],
            error: false,
          });
      })
      .catch(() => {
        if (!request.signal.aborted)
          setState({ api: actions, attempt, items: [], error: true });
      });
    return () => request.abort();
  }, [actions, attempt]);
  const current =
    state?.api === actions && state.attempt === attempt ? state : null;
  const back = useCallback(() => {
    if (closed.current) return;
    closed.current = true;
    controller.current?.abort();
    onBack();
  }, [onBack]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        back();
        return true;
      },
    );
    return () => subscription.remove();
  }, [back]);
  return (
    <DayScreen>
      <View style={styles.header}>
        <Action label="양떼로 돌아가기" onPress={back} />
        <Text accessibilityRole="header" style={styles.heading}>
          담은 노래
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {!current ? (
          <View style={styles.panel}>
            <ActivityIndicator color="#2F3A9E" />
            <Text style={styles.text}>담은 노래를 불러오고 있어요.</Text>
          </View>
        ) : current.error ? (
          <View style={styles.panel}>
            <Text accessibilityRole="alert" style={styles.text}>
              노래 목록을 불러오지 못했어요.
            </Text>
            <Action
              label="다시 불러오기"
              onPress={() => setAttempt((v) => v + 1)}
            />
          </View>
        ) : current.items.length === 0 ? (
          <View style={styles.panel}>
            <Text style={styles.text}>담은 노래가 없어요.</Text>
            <Text style={styles.text}>
              밤에 만난 노래를 담아 두면 여기서 다시 찾을 수 있어요.
            </Text>
          </View>
        ) : (
          current.items.map((item) => (
            <SavedSongRow
              key={item.card_id}
              item={item}
              actions={actions}
              external={external}
              onRemoved={() =>
                setState((previous) =>
                  previous && previous.api === actions
                    ? {
                        ...previous,
                        items: previous.items.filter(
                          (song) => song.card_id !== item.card_id,
                        ),
                      }
                    : previous,
                )
              }
            />
          ))
        )}
      </ScrollView>
    </DayScreen>
  );
}
function Cover({ item }: { item: SavedSong }) {
  const [failed, setFailed] = useState(false);
  return (
    <Image
      source={
        item.track.cover_url && !failed
          ? { uri: item.track.cover_url }
          : require('../../../assets/images/songs/record.svg')
      }
      contentFit="contain"
      style={styles.cover}
      accessible={false}
      onError={() => setFailed(true)}
    />
  );
}
function SavedSongRow({
  item,
  actions,
  external,
  onRemoved,
}: {
  item: SavedSong;
  actions: SongActions;
  external: SongExternalActions;
  onRemoved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState(false);
  const [noticeKind, setNoticeKind] = useState<
    'open' | 'copy' | 'remove' | null
  >(null);
  const active = useRef<AbortController | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      active.current?.abort();
    };
  }, [actions, external]);
  const run = async (kind: 'open' | 'copy' | 'remove') => {
    if (active.current || !alive.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setNotice('');
    setNoticeKind(kind);
    setError(false);
    try {
      if (kind === 'remove') {
        const value = await actions.set(item.card_id, false, controller.signal);
        if (value !== false) throw new Error('Song still saved');
      } else await external[kind](item.track);
      if (controller.signal.aborted || !alive.current) return;
      if (kind === 'remove') onRemoved();
      else
        setNotice(
          kind === 'copy'
            ? '곡 정보를 복사했어요.'
            : 'Spotify를 열었어요. 검색어가 보이지 않으면 곡 정보를 복사해 검색해 주세요.',
        );
    } catch {
      if (!controller.signal.aborted && alive.current) {
        setError(true);
        setNotice(
          kind === 'open'
            ? 'Spotify를 열지 못했어요. 다시 시도하거나 곡 정보를 복사해 주세요.'
            : kind === 'copy'
              ? '복사하지 못했어요. 다시 시도해 주세요.'
              : '담기를 취소하지 못했어요. 다시 시도해 주세요.',
        );
      }
    } finally {
      if (active.current === controller) active.current = null;
      if (alive.current && !controller.signal.aborted) setBusy(false);
    }
  };
  return (
    <View style={styles.panel}>
      <View style={styles.row}>
        <Cover key={`${item.card_id}:${item.track.cover_url}`} item={item} />
        <View style={styles.info}>
          <Text style={styles.caption}>어젯밤 담은 노래</Text>
          <Text accessibilityRole="header" style={styles.title}>
            {item.track.title}
          </Text>
          <Text style={styles.text}>{item.track.artist}</Text>
        </View>
      </View>
      {(['open', 'copy', 'remove'] as const).map((kind) => (
        <View key={kind} style={styles.actionGroup}>
          {notice && noticeKind === kind ? (
            <Text
              accessibilityRole={error ? 'alert' : undefined}
              accessibilityLiveRegion="polite"
              style={styles.text}
            >
              {notice}
            </Text>
          ) : null}
          <Action
            label={
              kind === 'open'
                ? 'Spotify에서 찾기'
                : kind === 'copy'
                  ? '곡 정보 복사'
                  : '담기 취소'
            }
            disabled={busy}
            onPress={() => void run(kind)}
          />
        </View>
      ))}
    </View>
  );
}
function Action({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.action, disabled && { opacity: 0.5 }]}
    >
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  actionGroup: { gap: 8 },
  header: {
    backgroundColor: '#D8DFFF',
    paddingHorizontal: 12,
    minHeight: 52,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
  },
  heading: {
    fontFamily: theme.font,
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '700',
    color: '#242565',
  },
  content: { padding: 20, gap: 20, paddingBottom: 32 },
  panel: {
    padding: 14,
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#2F3A9E',
    boxShadow: '4px 4px 0 #AFC0FF',
  },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  cover: { width: 38, height: 38 },
  info: { flex: 1, gap: 6 },
  caption: {
    fontFamily: theme.font,
    fontSize: 10,
    lineHeight: 17,
    color: '#5B6BC8',
  },
  title: {
    fontFamily: theme.font,
    fontSize: 14,
    lineHeight: 23,
    fontWeight: '700',
    color: '#2F3A9E',
  },
  text: {
    fontFamily: theme.font,
    fontSize: 13,
    lineHeight: 22,
    color: '#2F3A9E',
  },
  action: {
    backgroundColor: '#FFE7A3',
    minHeight: 48,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

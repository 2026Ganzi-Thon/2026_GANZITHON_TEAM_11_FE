import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Image } from 'expo-image';
import {
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button } from '../../ui/Button';
import { NightScreen } from '../../ui/NightScreen';
import { theme } from '../../ui/theme';
import { TextCardArtwork } from './TextCardArtwork';
import {
  PREVIEW_RECOMMENDATION_LIMIT,
  type SongCardActions,
} from './songTypes';
import { useSongCardWriting } from './useSongCardWriting';
import { useTrackSearch } from './useTrackSearch';
import { TrackSelection } from './TrackSelection';
function message(value: unknown) {
  return typeof value === 'string'
    ? value
    : Array.isArray(value)
      ? value.filter((v) => typeof v === 'string').join('\n')
      : null;
}
export function SongCardScreen(props: Parameters<typeof SongCardSession>[0]) {
  const [source, setSource] = useState({
    actions: props.actions,
    night: props.sourceNightId,
    version: 0,
  });
  if (
    source.actions !== props.actions ||
    source.night !== props.sourceNightId
  ) {
    setSource({
      actions: props.actions,
      night: props.sourceNightId,
      version: source.version + 1,
    });
  }
  return <SongCardSession key={source.version} {...props} />;
}
function SongCardSession({
  actions,
  sourceNightId,
  onBack,
  onDone,
  modal = false,
}: {
  actions: SongCardActions;
  sourceNightId: string;
  onBack: () => void;
  onDone: () => void;
  modal?: boolean;
}) {
  const flow = useSongCardWriting(actions, sourceNightId, onBack, onDone),
    { draft, pending, step, error } = flow;
  const manual = draft.selection?.mode === 'manual' ? draft.selection : null;
  const selected =
    draft.selection?.mode === 'search' ? draft.selection.track : null;
  const search = useTrackSearch(
    actions,
    draft.query,
    !manual && !pending && step === 'write',
  );
  const body = useRef<ComponentRef<typeof ScrollView>>(null);
  const back = flow.back;
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      back();
      return true;
    });
    return () => sub.remove();
  }, [back]);
  const fieldErrors = Object.values(error?.fields ?? {})
    .map(message)
    .filter(Boolean);
  const results =
    selected && !search.items.some((t) => t.id === selected.id)
      ? [selected, ...search.items]
      : search.items;
  const content = (
    <NightScreen
      background={require('../../../assets/images/my-cards/background.svg')}
    >
      {step !== 'complete' && (
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="이전"
            accessibilityState={{ disabled: pending }}
            disabled={pending}
            onPress={flow.back}
            style={styles.back}
          >
            <Text style={styles.arrow}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle} accessibilityRole="header">
            노래 추천
          </Text>
        </View>
      )}
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          key={step}
          ref={body}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          {step === 'complete' ? (
            <>
              <View style={styles.spacer} />
              <TextCardArtwork />
              <View style={styles.panel}>
                <Text style={styles.title} accessibilityRole="header">
                  카드를 맡겼어요
                </Text>
                <Text style={styles.text}>
                  검수를 기다리고 있어요. 승인된 뒤 다른 사람에게 보여요.
                </Text>
              </View>
              <View style={styles.spacer} />
              <Button label="이제 잘게요" onPress={flow.back} />
            </>
          ) : step === 'support' ? (
            <>
              <View style={styles.panel}>
                <Text style={styles.title} accessibilityRole="header">
                  제출을 잠시 멈췄어요
                </Text>
                <Text style={styles.text}>
                  {error?.serverMessage ?? '지금은 잠시 쉬어 가도 괜찮아요.'}
                </Text>
                <Text style={styles.hint}>
                  곡과 추천 문장을 유지했어요. 도움 안내는 고정 예시이며 실제
                  안전 검사와 연결되지 않았어요.
                </Text>
              </View>
              <Button label="쓰던 글로 돌아가기" onPress={flow.returnToDraft} />
            </>
          ) : (
            <>
              {!manual ? (
                <>
                  <View style={[styles.panel, styles.search]}>
                    <Image
                      source={require('../../../assets/images/song-card/search.svg')}
                      style={styles.icon}
                      accessible={false}
                    />
                    <TextInput
                      accessibilityLabel="곡 이름 또는 가수 검색"
                      placeholder="곡 이름 또는 가수"
                      placeholderTextColor={theme.color.muted}
                      editable={!pending}
                      value={draft.query}
                      onChangeText={(query) =>
                        flow.update({ query, selection: null })
                      }
                      style={[styles.input, styles.fill]}
                    />
                  </View>
                  {search.status === 'invalid' && (
                    <Text
                      accessibilityRole="alert"
                      style={[styles.error, styles.panel]}
                    >
                      검색어는 앞뒤 공백을 제외해 1~100자로 적어 주세요.
                    </Text>
                  )}
                  {search.status === 'idle' && (
                    <Text style={[styles.hint, styles.panel]}>
                      곡 이름이나 가수를 입력하면 예시 결과가 나타나요.
                    </Text>
                  )}
                  {search.status === 'loading' && (
                    <Text
                      accessibilityLiveRegion="polite"
                      style={[styles.hint, styles.panel]}
                    >
                      곡을 찾고 있어요
                    </Text>
                  )}
                  {search.status === 'error' && (
                    <View style={styles.panel} accessibilityRole="alert">
                      <Text style={styles.text}>
                        곡을 찾지 못했어요. 잠시 후 다시 시도해 주세요.
                      </Text>
                      <Button
                        label="검색 다시 시도"
                        disabled={pending}
                        onPress={search.retry}
                      />
                    </View>
                  )}
                  {results.map((track) => (
                    <TrackSelection
                      key={track.id}
                      track={track}
                      checked={selected?.id === track.id}
                      disabled={pending}
                      onPress={() => {
                        Keyboard.dismiss();
                        flow.update({ selection: { mode: 'search', track } });
                      }}
                    />
                  ))}
                  {search.status === 'done' &&
                    !search.items.length &&
                    !selected && (
                      <View style={styles.panel}>
                        <Text style={styles.text}>검색 결과가 없어요</Text>
                        <Button
                          label="곡 직접 입력"
                          disabled={pending}
                          onPress={() =>
                            flow.update({
                              selection: {
                                mode: 'manual',
                                title: draft.query,
                                artist: '',
                              },
                            })
                          }
                        />
                      </View>
                    )}
                </>
              ) : (
                <View style={styles.panel}>
                  <Text style={styles.section}>곡 직접 입력</Text>
                  <TextInput
                    accessibilityLabel="곡 제목"
                    placeholder="곡 제목"
                    placeholderTextColor={theme.color.muted}
                    value={manual.title}
                    editable={!pending}
                    onChangeText={(title) =>
                      flow.update({ selection: { ...manual, title } })
                    }
                    style={styles.input}
                  />
                  <TextInput
                    accessibilityLabel="가수"
                    placeholder="가수"
                    placeholderTextColor={theme.color.muted}
                    value={manual.artist}
                    editable={!pending}
                    onChangeText={(artist) =>
                      flow.update({ selection: { ...manual, artist } })
                    }
                    style={styles.input}
                  />
                  <Text style={styles.hint}>
                    제목과 가수를 각각 1~200자로 적어 주세요. 검수할 때 곡을
                    확인해요.
                  </Text>
                  <Button
                    label="곡 다시 찾기"
                    disabled={pending}
                    onPress={() => flow.update({ selection: null })}
                  />
                </View>
              )}
              <View style={styles.panel}>
                <TextInput
                  accessibilityLabel="추천 한 줄"
                  placeholder="어떤 순간에 기대기 좋은 노래인가요?"
                  placeholderTextColor={theme.color.muted}
                  multiline
                  textAlignVertical="top"
                  scrollEnabled
                  editable={!pending}
                  value={draft.recommendation}
                  onChangeText={(recommendation) =>
                    flow.update({ recommendation })
                  }
                  style={[styles.input, styles.recommendation]}
                />
                <Text
                  style={[
                    styles.counter,
                    flow.length > PREVIEW_RECOMMENDATION_LIMIT && styles.error,
                  ]}
                  accessibilityLiveRegion="polite"
                >
                  {flow.length} / {PREVIEW_RECOMMENDATION_LIMIT}
                </Text>
              </View>
              <Text style={[styles.hint, styles.panel]}>
                추천 이유를 내 말로 적어 주세요. 가사는 옮겨 적지 않아요.
              </Text>
              {error && (
                <View
                  style={styles.panel}
                  accessibilityRole="alert"
                  onLayout={(e) =>
                    body.current?.scrollTo({
                      y: e.nativeEvent.layout.y,
                      animated: false,
                    })
                  }
                >
                  <Text style={styles.section}>
                    {flow.blocked
                      ? '작성할 수 있는 밤을 확인해 주세요'
                      : error.code === 'SAFETY_CHECK_UNAVAILABLE'
                        ? '지금은 검수를 요청할 수 없어요'
                        : '접수를 확인하지 못했어요'}
                  </Text>
                  {fieldErrors.map((text, i) => (
                    <Text key={i} style={styles.error}>
                      {text}
                    </Text>
                  ))}
                  <Text style={styles.text}>
                    {flow.blocked
                      ? '곡과 문장을 유지했어요. 이전으로 돌아가 작성 상태를 확인해 주세요.'
                      : '곡과 문장을 유지했어요. 잠시 후 다시 요청할 수 있어요.'}
                  </Text>
                </View>
              )}
              <View style={styles.spacer} />
              {pending && (
                <Text
                  accessibilityLiveRegion="polite"
                  style={[styles.hint, styles.panel]}
                >
                  접수를 확인하고 있어요. 잠시 기다려 주세요.
                </Text>
              )}
              <Button
                label="검수 요청하기"
                disabled={!flow.valid || flow.blocked}
                busy={pending}
                onPress={() => {
                  Keyboard.dismiss();
                  void flow.submit();
                }}
              />
            </>
          )}
          <Text style={[styles.hint, styles.panel]}>
            미리보기 · 실제 곡 검색·전송 안 함. 추천 문장은 앞뒤 공백 제외 50자
            임시 기준이에요. 초안과 접수 결과는 같은 시연 안에서만 유지돼요.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </NightScreen>
  );
  return modal ? (
    <Modal
      visible
      animationType="none"
      onRequestClose={flow.back}
      testID="song-card-modal"
    >
      {content}
    </Modal>
  ) : (
    content
  );
}
const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    minHeight: 52,
    paddingHorizontal: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  back: {
    minHeight: 48,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: { fontSize: 20, color: theme.color.text },
  headerTitle: {
    fontFamily: theme.font,
    color: theme.color.text,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 14,
    flexGrow: 1,
  },
  panel: {
    backgroundColor: '#2B3591',
    padding: 16,
    gap: 8,
    boxShadow: '4px 4px 0 #0E1040',
  },
  search: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  icon: { width: 20, height: 20 },
  input: {
    fontFamily: theme.font,
    color: theme.color.text,
    fontSize: 15,
    lineHeight: 24,
    padding: 0,
    minHeight: 36,
  },
  recommendation: { minHeight: 44 },
  counter: {
    fontFamily: theme.font,
    color: theme.color.muted,
    fontSize: 12,
    lineHeight: 20,
    textAlign: 'right',
  },
  title: {
    fontFamily: theme.font,
    color: theme.color.text,
    fontSize: 22,
    lineHeight: 32,
    fontWeight: '700',
    textAlign: 'center',
  },
  text: {
    fontFamily: theme.font,
    color: theme.color.text,
    fontSize: 14,
    lineHeight: 22,
  },
  section: {
    fontFamily: theme.font,
    color: theme.color.text,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
  },
  hint: {
    fontFamily: theme.font,
    color: theme.color.muted,
    fontSize: 12,
    lineHeight: 20,
  },
  error: {
    fontFamily: theme.font,
    color: theme.color.error,
    fontSize: 14,
    lineHeight: 22,
  },
  spacer: { flexGrow: 1 },
});

import {
  type ComponentRef,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { DayScreen } from '../morning/DayScreen';
import { theme } from '../../ui/theme';
import { useDecoration } from './useDecoration';
import { DecorationCanvas, type CanvasHandle } from './DecorationCanvas';
import { StickerArt } from './StickerArt';
import { DragItem } from './DragItem';
import type { DecoratedSheep, DecorationActions } from './types';
interface Props {
  sheepId: string;
  actions: DecorationActions;
  onSaved: (sheep: DecoratedSheep) => void;
  onBack: () => void;
  onRead?: (sheep: DecoratedSheep) => void;
  modal?: boolean;
}
export function DecorationScreen(props: Props) {
  const [source, setSource] = useState({
    id: props.sheepId,
    actions: props.actions,
    version: 0,
  });
  if (source.id !== props.sheepId || source.actions !== props.actions)
    setSource({
      id: props.sheepId,
      actions: props.actions,
      version: source.version + 1,
    });
  return <Session key={source.version} {...props} />;
}
function Session({
  sheepId,
  actions,
  onSaved,
  onBack,
  onRead,
  modal = false,
}: Props) {
  const flow = useDecoration(sheepId, actions, onSaved, onBack, onRead),
    canvas = useRef<CanvasHandle>(null);
  const [dragging, setDragging] = useState(false),
    [failed, setFailed] = useState(new Set<string>()),
    [assetVersion, setAssetVersion] = useState(0);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const feedback =
    ['verify', 'conflict', 'day-only', 'saved'].includes(flow.phase) ||
    !!flow.notice;
  useEffect(() => {
    if (!feedback) return;
    const frame = requestAnimationFrame(() =>
      scroll.current?.scrollToEnd({ animated: false }),
    );
    return () => cancelAnimationFrame(frame);
  }, [feedback, flow.phase, flow.notice]);
  const editable = flow.phase === 'edit',
    pending = flow.phase === 'saving' || flow.phase === 'checking';
  const selected = flow.draft.find((p) => p.instance_id === flow.selected);
  const selectedFailed = !!selected && failed.has(selected.sticker_id);
  const uncertain = flow.phase === 'verify';
  const errorAsset = (id: string) => setFailed((old) => new Set([...old, id]));
  const busyBack = useRef(flow.back);
  useLayoutEffect(() => {
    busyBack.current = flow.back;
  });
  useEffect(() => {
    if (modal) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      busyBack.current();
      return true;
    });
    return () => sub.remove();
  }, [modal]);
  const button = (
    label: string,
    action: () => void,
    disabled = false,
    primary = false,
  ) => (
    <Pressable
      key={label === '저장 중' ? '저장' : label}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy: pending }}
      disabled={disabled}
      onPress={() => {
        action();
      }}
      style={[s.button, primary && s.primary, disabled && !pending && s.dim]}
    >
      <View style={s.buttonInner}>
        {label === '저장 중' && <ActivityIndicator color="#2F3A9E" />}
        <Text style={s.buttonText}>{label}</Text>
      </View>
    </Pressable>
  );
  const body = (
    <DayScreen>
      <View style={s.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="꾸미기 닫기"
          disabled={pending}
          accessibilityState={{ disabled: pending }}
          onPress={flow.back}
          style={s.back}
        >
          <Text style={s.backText}>←</Text>
        </Pressable>
        <Text accessibilityRole="header" style={s.title}>
          꾸미기
        </Text>
      </View>
      <ScrollView
        ref={scroll}
        onContentSizeChange={() => {
          if (feedback) scroll.current?.scrollToEnd({ animated: false });
        }}
        scrollEnabled={!dragging}
        contentContainerStyle={s.content}
      >
        {!flow.data ? (
          <View style={s.panel}>
            {flow.phase === 'load-error' ? (
              <>
                <Text accessibilityRole="alert" style={s.text}>
                  꾸미기 정보를 불러오지 못했어요.
                </Text>
                {button('꾸미기 다시 불러오기', flow.initial)}
              </>
            ) : (
              <>
                <ActivityIndicator color="#2F3A9E" />
                <Text style={s.text}>꾸미기를 불러오고 있어요.</Text>
              </>
            )}
          </View>
        ) : (
          <>
            <View style={s.preview}>
              <DecorationCanvas
                key={assetVersion}
                ref={canvas}
                sheep={flow.data.sheep}
                stickers={flow.data.stickers}
                placements={flow.draft}
                selected={flow.selected}
                disabled={!editable}
                failed={failed}
                onSelect={flow.setSelected}
                onChange={flow.change}
                onAdd={flow.add}
                onDrag={setDragging}
                onAssetError={errorAsset}
              />
              <Text style={s.hint}>스티커를 끌어다 양에게 붙여요</Text>
            </View>
            <Text accessibilityRole="header" style={s.section}>
              스티커
            </Text>
            <View style={s.palette}>
              {flow.data.stickers.map((st) => (
                <DragItem
                  key={`${assetVersion}:${st.id}`}
                  disabled={
                    !editable || failed.has(st.id) || flow.draft.length >= 20
                  }
                  onStart={() => setDragging(true)}
                  onMove={(g) =>
                    canvas.current?.preview(st.id, g.moveX, g.moveY)
                  }
                  onDrop={(g) => {
                    setDragging(false);
                    canvas.current?.drop(st.id, g.moveX, g.moveY);
                  }}
                  onCancel={() => {
                    setDragging(false);
                    canvas.current?.clear();
                  }}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${st.label} 스티커 붙이기`}
                    accessibilityHint="누르면 양 가운데에 붙여요. 붙인 뒤 방향 버튼으로 옮길 수도 있어요."
                    accessibilityState={{
                      disabled:
                        !editable ||
                        failed.has(st.id) ||
                        flow.draft.length >= 20,
                    }}
                    disabled={
                      !editable || failed.has(st.id) || flow.draft.length >= 20
                    }
                    onPress={() => flow.add(st.id)}
                    style={[s.tile, failed.has(st.id) && s.dim]}
                  >
                    <StickerArt
                      shape={st.asset_key}
                      onError={() => errorAsset(st.id)}
                      testID={`catalog-image-${st.id}`}
                    />
                  </Pressable>
                </DragItem>
              ))}
            </View>
            {flow.draft.length >= 20 && (
              <Text accessibilityLiveRegion="polite" style={s.hint}>
                스티커는 20개까지 붙일 수 있어요. 하나를 지우면 더 붙일 수
                있어요.
              </Text>
            )}
            {selected && (
              <View style={s.panel}>
                <Text style={s.text}>
                  선택한 스티커 ·{' '}
                  {
                    flow.data.stickers.find(
                      (st) => st.id === selected.sticker_id,
                    )?.label
                  }
                </Text>
                {!selectedFailed && (
                  <View style={s.controls}>
                    {[
                      ['왼쪽으로 이동', { x: selected.x - 0.05 }],
                      ['오른쪽으로 이동', { x: selected.x + 0.05 }],
                      ['위로 이동', { y: selected.y - 0.05 }],
                      ['아래로 이동', { y: selected.y + 0.05 }],
                      ['왼쪽으로 회전', { rotation: selected.rotation - 15 }],
                      ['오른쪽으로 회전', { rotation: selected.rotation + 15 }],
                      ['작게', { scale: selected.scale - 0.25 }],
                      ['크게', { scale: selected.scale + 0.25 }],
                    ].map(([label, patch]) =>
                      button(
                        label as string,
                        () =>
                          flow.change(selected.instance_id, patch as object),
                        !editable,
                      ),
                    )}
                  </View>
                )}
                {button('선택한 스티커 삭제', flow.remove, !editable)}
              </View>
            )}
            {failed.size > 0 && (
              <View style={s.panel}>
                <Text accessibilityRole="alert" style={s.text}>
                  스티커 그림을 불러오지 못했어요. 해당 스티커를 다시 불러와
                  주세요.
                </Text>
                {button(
                  '스티커 그림 다시 불러오기',
                  () => {
                    setFailed(new Set());
                    setAssetVersion((n) => n + 1);
                  },
                  pending,
                )}
              </View>
            )}
            <View style={s.spacer} />
            <View style={s.footer}>
              {flow.notice && (
                <Text
                  accessibilityLiveRegion="polite"
                  style={[s.text, s.panel]}
                >
                  {flow.notice}
                </Text>
              )}
              {(editable || flow.phase === 'saving') &&
                button(
                  pending ? '저장 중' : '저장',
                  flow.save,
                  pending ||
                    !flow.dirty ||
                    flow.draft.some((p) => failed.has(p.sticker_id)),
                  true,
                )}
              {pending && (
                <View accessibilityLiveRegion="polite" style={s.progress}>
                  <ActivityIndicator color="#2F3A9E" />
                  <Text style={s.text}>
                    {flow.phase === 'saving'
                      ? '꾸미기를 저장하고 있어요.'
                      : '저장 상태를 확인하고 있어요.'}
                  </Text>
                </View>
              )}
              {flow.phase === 'verify' && (
                <View style={s.panel}>
                  <Text accessibilityRole="alert" style={s.text}>
                    저장 여부를 확인하지 못했어요. 먼저 저장 상태를 확인해
                    주세요.
                  </Text>
                  {button('저장 상태 확인', flow.verify, false, true)}
                </View>
              )}
              {flow.phase === 'conflict' && (
                <View style={s.panel}>
                  <Text accessibilityRole="alert" style={s.text}>
                    최신 배치와 편집한 내용이 달라요. 최신 배치로 바꾸면 지금
                    편집한 내용은 사라져요.
                  </Text>
                  {button('최신 배치로 다시 꾸미기', flow.reload, false, true)}
                </View>
              )}
              {flow.phase === 'day-only' && (
                <View style={s.panel}>
                  <Text accessibilityRole="alert" style={s.text}>
                    꾸미기는 낮에만 저장할 수 있어요. 오전 4시부터 밤 9시 전에
                    다시 들러 주세요.
                  </Text>
                  {button('양떼로 돌아가기', flow.leave)}
                </View>
              )}
              {flow.phase === 'saved' && (
                <View style={s.panel}>
                  <Text accessibilityLiveRegion="polite" style={s.text}>
                    꾸미기를 저장했어요.
                  </Text>
                  {button('양떼로 돌아가기', flow.back)}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
      <Modal
        visible={flow.discard}
        transparent
        animationType="none"
        onRequestClose={() => flow.setDiscard(false)}
        statusBarTranslucent
        navigationBarTranslucent
      >
        <View style={s.dimLayer}>
          <View accessibilityViewIsModal style={s.dialog}>
            <ScrollView contentContainerStyle={{ gap: 14 }}>
              <Text accessibilityRole="header" style={s.title}>
                {uncertain
                  ? '저장 상태를 확인할까요?'
                  : '저장하지 않고 나갈까요?'}
              </Text>
              <Text style={s.text}>
                {uncertain
                  ? '이미 저장됐을 수도 있어요. 나가기 전에 확인해 보세요.'
                  : '편집한 꾸미기는 사라져요.'}
              </Text>
              {uncertain
                ? button(
                    '저장 상태 확인하기',
                    () => {
                      flow.setDiscard(false);
                      void flow.verify();
                    },
                    false,
                    true,
                  )
                : button(
                    '계속 꾸미기',
                    () => flow.setDiscard(false),
                    false,
                    true,
                  )}
              {button(
                uncertain ? '확인하지 않고 나가기' : '저장하지 않고 나가기',
                flow.leave,
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </DayScreen>
  );
  return modal ? (
    <Modal
      testID="decoration-modal"
      visible
      animationType="none"
      onRequestClose={flow.back}
      statusBarTranslucent
      navigationBarTranslucent
    >
      {body}
    </Modal>
  ) : (
    body
  );
}
const s = StyleSheet.create({
  header: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingRight: 20,
  },
  back: {
    minWidth: 52,
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    fontFamily: theme.font,
    fontSize: 24,
    lineHeight: 32,
    color: '#242565',
  },
  title: {
    fontFamily: theme.font,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    color: '#242565',
    flexShrink: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 14,
    flexGrow: 1,
  },
  preview: { minHeight: 230 },
  hint: {
    fontFamily: theme.font,
    fontSize: 11,
    lineHeight: 17,
    color: '#4A5290',
    textAlign: 'center',
  },
  section: {
    fontFamily: theme.font,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
    color: '#4A5290',
  },
  palette: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: 52,
    height: 52,
    borderRadius: 4,
    backgroundColor: '#E6EBFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  text: {
    fontFamily: theme.font,
    fontSize: 14,
    lineHeight: 22,
    color: '#242565',
    flexShrink: 1,
  },
  button: {
    backgroundColor: '#E6EBFF',
    borderRadius: 4,
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    minHeight: 52,
    backgroundColor: '#FFE7A3',
    boxShadow: '6px 6px 0 #D9B65E',
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    flexShrink: 1,
    fontFamily: theme.font,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '700',
    color: '#2F3A9E',
    textAlign: 'center',
  },
  dim: { opacity: 0.6 },
  panel: { backgroundColor: '#F4F5FF', padding: 14, gap: 12, borderRadius: 4 },
  footer: { gap: 12 },
  progress: {
    backgroundColor: '#F4F5FF',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  spacer: { flex: 1, minHeight: 10 },
  dimLayer: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#1E206399',
  },
  dialog: {
    padding: 20,
    backgroundColor: '#F4F5FF',
    borderRadius: 4,
    maxHeight: '90%',
    borderWidth: 2,
    borderColor: '#4A5290',
  },
});

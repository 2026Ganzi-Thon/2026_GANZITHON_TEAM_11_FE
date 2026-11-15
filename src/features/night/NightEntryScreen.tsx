import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentRef,
} from 'react';
import {
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button } from '../../ui/Button';
import { NightScreen } from '../../ui/NightScreen';
import { Notice } from '../../ui/Notice';
import { theme } from '../../ui/theme';
import { ApiError } from '../../api/errors';
import { SupportContent } from '../support/SupportContent';
import { readSupport } from '../support/model';
import { categories } from './categories';
import { CategoryShelf } from './CategoryShelf';
import {
  PREVIEW_WORRY_LIMIT,
  validateWorry,
  readNightWorryResult,
  type NightWorryResult,
  type WorryDraft,
  type CategoryId,
  type NightEntryActions,
} from './entry';
import { SheepCountPicker } from './SheepCountPicker';
import { WorryPaper } from './WorryPaper';
import { FeedScreen } from './feed/FeedScreen';
import type { ClosingActions } from './closing/types';
import type { FeedLoad } from './feed/model';

/** Transient preview flow. No persistence or safety decision; feed loading is explicitly injected. */
export function NightEntryScreen(
  props: Parameters<typeof NightEntrySession>[0],
) {
  const [source, setSource] = useState({
    actions: props.actions,
    mode: props.mode,
    version: 0,
  });
  if (source.actions !== props.actions || source.mode !== props.mode)
    setSource({
      actions: props.actions,
      mode: props.mode,
      version: source.version + 1,
    });
  return <NightEntrySession key={source.version} {...props} />;
}
function NightEntrySession({
  actions,
  onBack,
  worryLimit = PREVIEW_WORRY_LIMIT,
  createFeed,
  closingActions,
  onStarted,
  initialCount = 15,
  mode = 'first-entry',
}: {
  actions: NightEntryActions;
  onBack: () => void;
  worryLimit?: number;
  createFeed?: (count: number) => FeedLoad;
  closingActions?: ClosingActions;
  onStarted?: () => void;
  initialCount?: number;
  mode?: 'first-entry' | 'existing-night';
}) {
  const [feedLoad, setFeedLoad] = useState<FeedLoad | null>(null);
  const [step, setStep] = useState<'worry' | 'support' | 'count'>(
    mode === 'existing-night' ? 'count' : 'worry',
  );
  const [support, setSupport] = useState<{
    night: NightWorryResult;
    draft: WorryDraft;
  } | null>(null);
  const [supportOperation, setSupportOperation] = useState<
    'continue' | 'reload' | null
  >(null);
  const [supportError, setSupportError] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<CategoryId | null>(null);
  const [text, setText] = useState('');
  const [count, setCount] = useState(initialCount);
  const [status, setStatus] = useState<'idle' | 'pending' | 'error' | 'done'>(
    'idle',
  );
  const [validation, setValidation] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const category = categories.find((item) => item.id === categoryId);
  const pending = status === 'pending';

  useEffect(
    () => () => {
      active.current?.abort();
      active.current = null;
    },
    [],
  );
  const back = useCallback(() => {
    active.current?.abort();
    active.current = null;
    Keyboard.dismiss();
    setStatus('idle');
    setValidation(null);
    setSupportOperation(null);
    setSupportError(null);
    setSupport(null);
    if (mode === 'first-entry' && (step === 'count' || step === 'support'))
      setStep('worry');
    else onBack();
  }, [mode, onBack, step]);
  useEffect(() => {
    if (feedLoad) return;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        back();
        return true;
      },
    );
    return () => subscription.remove();
  }, [back, feedLoad]);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [step]);

  const submit = async () => {
    if (active.current || status === 'done' || step === 'support') return;
    if (step === 'worry') {
      const error = validateWorry(categoryId, text, worryLimit);
      setValidation(error);
      if (error || !categoryId) return;
    }
    const controller = new AbortController();
    active.current = controller;
    setStatus('pending');
    Keyboard.dismiss();
    try {
      if (step === 'worry' && categoryId) {
        const draft: WorryDraft = {
          category_id: categoryId,
          worry_text: categoryId === 'none' ? null : text.trim(),
        };
        const result = await actions.checkWorry(draft, controller.signal);
        if (controller.signal.aborted || active.current !== controller) return;
        const night = readNightWorryResult(result);
        if (night.status === 'needs_support') {
          setSupport({ night, draft });
          setSupportError(null);
          setStep('support');
        } else setStep('count');
        setStatus('idle');
      } else {
        await actions.startCounting(count, controller.signal);
        if (controller.signal.aborted) return;
        if (onStarted) {
          setStatus('done');
          onStarted();
        } else if (createFeed) {
          const load = createFeed(count);
          setFeedLoad(() => load);
          setStatus('idle');
        } else setStatus('done');
      }
    } catch {
      if (!controller.signal.aborted) setStatus('error');
    } finally {
      if (active.current === controller) active.current = null;
    }
  };
  async function supportRequest(operation: 'continue' | 'reload') {
    if (step !== 'support' || !support || active.current) return;
    if (operation === 'continue' && !readSupport(support.night.support)) return;
    const controller = new AbortController();
    active.current = controller;
    setSupportOperation(operation);
    setSupportError(null);
    setStatus('pending');
    try {
      if (operation === 'reload') {
        const result = await actions.checkWorry(
          { ...support.draft },
          controller.signal,
        );
        if (controller.signal.aborted || active.current !== controller) return;
        const night = readNightWorryResult(result);
        if (night.id !== support.night.id || night.status !== 'needs_support')
          throw new ApiError('invalid-response');
        setSupport({ ...support, night });
      } else {
        const result = await actions.continueSupport(
          support.night.id,
          controller.signal,
        );
        if (controller.signal.aborted || active.current !== controller) return;
        if (
          !result ||
          result.id !== support.night.id ||
          result.active_session_id !== null
        )
          throw new ApiError('invalid-response');
        setStep('count');
      }
      setStatus('idle');
    } catch {
      if (!controller.signal.aborted && active.current === controller) {
        setSupportError(
          operation === 'continue'
            ? '계속하기 응답을 확인하지 못했어요. 다시 시도해 주세요.'
            : '도움 안내를 다시 불러오지 못했어요. 다시 시도해 주세요.',
        );
        setStatus('error');
      }
    } finally {
      if (active.current === controller) {
        active.current = null;
        setSupportOperation(null);
      }
    }
  }
  const edit = () => {
    setValidation(null);
    setStatus('idle');
  };
  const missing =
    step === 'worry' &&
    (!categoryId || (categoryId !== 'none' && !text.trim()));

  if (feedLoad)
    return (
      <FeedScreen
        load={feedLoad}
        onBack={() => setFeedLoad(null)}
        closingActions={closingActions}
      />
    );

  return (
    <NightScreen
      background={
        step === 'support'
          ? require('../../../assets/images/night-support/background.svg')
          : undefined
      }
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.topbar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="뒤로"
            onPress={back}
            style={styles.back}
          >
            <Text style={styles.backText}>←</Text>
          </Pressable>
          <Text style={styles.barTitle}>
            {step === 'worry'
              ? '오늘 밤'
              : step === 'support'
                ? '도움 안내'
                : '양 수 정하기'}
          </Text>
          <Text style={styles.preview}>미리보기 · 저장 안 함</Text>
        </View>
        <ScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          {step === 'support' ? (
            <SupportContent
              context="night"
              support={support?.night.support}
              pending={supportOperation}
              error={supportError}
              onContinue={() => void supportRequest('continue')}
              onReload={() => void supportRequest('reload')}
            />
          ) : step === 'worry' ? (
            <>
              <Text accessibilityRole="header" style={styles.title}>
                {'오늘은 어떤 고민을\n적어볼까요?'}
              </Text>
              <Text style={styles.hint}>책을 누르면 앞으로 꺼내져요</Text>
              <View style={styles.shelf}>
                <CategoryShelf
                  value={categoryId}
                  disabled={pending}
                  onChange={(id) => {
                    setCategoryId(id);
                    edit();
                  }}
                />
              </View>
              <View
                style={[
                  styles.tag,
                  { backgroundColor: category?.color ?? '#D3D8F2' },
                ]}
              >
                <Text style={styles.tagText}>{category?.label ?? ' '}</Text>
              </View>
              <WorryPaper
                category={category}
                value={text}
                limit={worryLimit}
                disabled={pending}
                onChange={(value) => {
                  setText(value);
                  edit();
                }}
              />
              <Text style={styles.privacy}>
                적은 글은 다른 사람에게 보이지 않아요
              </Text>
            </>
          ) : (
            <>
              <Text accessibilityRole="header" style={styles.countTitle}>
                오늘은 몇 마리 셀까요?
              </Text>
              <SheepCountPicker
                value={count}
                disabled={pending || status === 'done'}
                onChange={(value) => {
                  setCount(value);
                  edit();
                }}
              />
            </>
          )}
          {validation && (
            <View style={styles.message}>
              <Notice title={validation} error />
            </View>
          )}
          {status === 'error' && step !== 'support' && (
            <View style={styles.message}>
              <Notice
                title="응답을 확인하지 못했어요. 다시 시도해 주세요."
                error
              />
            </View>
          )}
          {status === 'done' && (
            <View style={styles.message}>
              <Notice
                title="미리보기를 마쳤어요"
                description={`${count}마리를 선택했어요. 실제 저장·안전 확인·양 세기는 진행하지 않았어요.`}
              />
            </View>
          )}
          {step !== 'support' && (
            <>
              <View style={styles.space} />
              {status === 'done' ? (
                <Button label="미리보기 닫기" onPress={onBack} />
              ) : (
                <Button
                  label={
                    pending
                      ? step === 'worry'
                        ? '확인 중'
                        : '준비 중'
                      : status === 'error'
                        ? '다시 시도'
                        : step === 'worry'
                          ? '다음'
                          : '양 세기 시작'
                  }
                  busy={pending}
                  disabled={missing}
                  onPress={() => {
                    void submit();
                  }}
                />
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </NightScreen>
  );
}
const styles = StyleSheet.create({
  flex: { flex: 1 },
  topbar: {
    minHeight: 52,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  back: {
    minWidth: 40,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { color: theme.color.text, fontSize: 24 },
  barTitle: {
    fontFamily: theme.font,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    color: theme.color.text,
  },
  preview: {
    marginLeft: 'auto',
    marginRight: 8,
    flexShrink: 1,
    fontFamily: theme.font,
    fontSize: 10,
    lineHeight: 15,
    color: theme.color.muted,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  title: {
    fontFamily: theme.font,
    fontWeight: '700',
    color: theme.color.text,
    fontSize: 23,
    lineHeight: 30,
    includeFontPadding: false,
  },
  countTitle: {
    fontFamily: theme.font,
    fontWeight: '700',
    color: theme.color.text,
    fontSize: 25,
    lineHeight: 35,
    includeFontPadding: false,
  },
  hint: {
    fontFamily: theme.font,
    color: theme.color.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 24,
  },
  shelf: { marginHorizontal: -10 },
  tag: {
    alignSelf: 'flex-start',
    minWidth: 48,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 12,
    marginBottom: 14,
  },
  tagText: {
    fontFamily: theme.font,
    fontWeight: '700',
    fontSize: 12,
    lineHeight: 18,
    includeFontPadding: false,
    color: theme.color.background,
  },
  privacy: {
    fontFamily: theme.font,
    color: theme.color.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 18,
  },
  message: { marginTop: 16 },
  space: { flex: 1, minHeight: 32 },
});

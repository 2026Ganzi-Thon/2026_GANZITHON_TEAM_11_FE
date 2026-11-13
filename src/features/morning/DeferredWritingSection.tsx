import { useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  CardWritingScreen,
  type CardWritingActions,
} from '../cards/CardWritingScreen';
import { theme } from '../../ui/theme';
import type { MorningActions } from './types';

/** Mounted for one source night; acceptance survives a failed status refresh. */
export function DeferredWritingSection({
  nightId,
  writing,
  loadMorning,
  onVisibilityChange,
}: {
  nightId: string;
  writing: CardWritingActions;
  loadMorning: MorningActions['loadMorning'];
  onVisibilityChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'confirmed' | 'error'
  >('idle');
  const request = useRef<AbortController | null>(null);
  const active = useRef(true);
  const confirmed = useRef(false);
  const { fontScale } = useWindowDimensions();
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      request.current?.abort();
    };
  }, []);
  useEffect(() => () => onVisibilityChange?.(false), [onVisibilityChange]);
  const refresh = async () => {
    if (!active.current || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setStatus('loading');
    try {
      const morning = await loadMorning(controller.signal, nightId);
      if (!active.current || controller.signal.aborted) return;
      setStatus(
        morning.night?.id === nightId &&
          morning.writing_offer?.state === 'fulfilled'
          ? 'confirmed'
          : 'error',
      );
    } catch {
      if (active.current && !controller.signal.aborted) setStatus('error');
    } finally {
      if (request.current === controller) request.current = null;
    }
  };
  return (
    <>
      <StatusBar style={open ? 'light' : 'dark'} />
      {accepted ? (
        <View style={styles.receipt}>
          <Text accessibilityLiveRegion="polite" style={styles.title}>
            {status === 'error'
              ? '카드는 접수됐어요. 작성 상태를 다시 확인해 주세요.'
              : status === 'confirmed'
                ? '미뤄 둔 카드를 맡겼어요.'
                : '카드는 접수됐어요. 작성 상태를 확인하고 있어요.'}
          </Text>
          {status === 'error' && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="작성 상태 다시 확인"
              style={styles.retry}
              onPress={() => void refresh()}
            >
              <Text style={styles.title}>작성 상태 다시 확인</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <View style={[styles.banner, fontScale > 1.3 && styles.expanded]}>
          <Image
            source={require('../../../assets/images/deferred-writing/banner.svg')}
            style={StyleSheet.absoluteFill}
            contentFit="fill"
            accessible={false}
          />
          <View style={styles.iconBox}>
            <Image
              source={require('../../../assets/images/deferred-writing/envelope.svg')}
              style={styles.icon}
              accessible={false}
            />
          </View>
          <View style={[styles.copy, fontScale > 1.3 && styles.expandedCopy]}>
            <Text style={styles.title}>어젯밤 미뤄 둔 카드가 있어요</Text>
            <Text style={styles.subtitle}>
              잠들기 전 그 마음, 지금 적어 볼래요?
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="미뤄 둔 카드 쓰기"
            onPress={() => {
              onVisibilityChange?.(true);
              setOpen(true);
            }}
            style={styles.writeTouch}
          >
            <View style={styles.write}>
              <Text style={styles.writeLabel}>쓰기</Text>
            </View>
          </Pressable>
        </View>
      )}
      {open && (
        <CardWritingScreen
          modal
          actions={writing}
          sourceNightId={nightId}
          entryContext="morning_banner"
          onBack={() => {
            setOpen(false);
            onVisibilityChange?.(false);
          }}
          onDone={() => {
            if (confirmed.current) return;
            confirmed.current = true;
            setOpen(false);
            onVisibilityChange?.(false);
            setAccepted(true);
            void refresh();
          }}
        />
      )}
    </>
  );
}
const styles = StyleSheet.create({
  banner: {
    minHeight: 64,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    boxShadow: '4px 4px 0 #AFC0FF',
  },
  expanded: { flexDirection: 'column', alignItems: 'flex-start', padding: 16 },
  iconBox: {
    width: 40,
    height: 40,
    backgroundColor: '#FFE7A3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { width: 24, height: 18 },
  copy: { flex: 1, gap: 3, flexShrink: 1 },
  expandedCopy: { flex: 0, alignSelf: 'stretch' },
  title: {
    fontFamily: theme.font,
    color: '#2F3A9E',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  subtitle: {
    fontFamily: theme.font,
    color: '#4A5290',
    fontSize: 11,
    lineHeight: 17,
  },
  writeTouch: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  write: {
    backgroundColor: '#2F3A9E',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  writeLabel: {
    fontFamily: theme.font,
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  receipt: { backgroundColor: '#FFF4D6', padding: 16, gap: 12 },
  retry: { minHeight: 48, justifyContent: 'center' },
});

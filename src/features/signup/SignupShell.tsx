import {
  useCallback,
  useEffect,
  useRef,
  type ComponentRef,
  type PropsWithChildren,
} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NightScreen } from '../../ui/NightScreen';
import { Button } from '../../ui/Button';
import { theme } from '../../ui/theme';
export function SignupShell({
  children,
  title,
  background,
  onBack,
  label,
  onSubmit,
  busy = false,
  disabled = false,
  error = '',
}: PropsWithChildren<{
  title?: string;
  background?: number;
  onBack: () => void;
  label: string;
  onSubmit: () => void;
  busy?: boolean;
  disabled?: boolean;
  error?: string;
}>) {
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const frame = useRef<number | null>(null);
  const revealStatus = useCallback(() => {
    if (!busy && !error) return;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      scroll.current?.scrollToEnd({ animated: false });
    });
  }, [busy, error]);
  useEffect(revealStatus, [revealStatus]);
  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );
  return (
    <NightScreen
      background={
        background ?? require('../../../assets/images/text-card/night.svg')
      }
    >
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={s.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="이전 단계"
            disabled={busy}
            accessibilityState={{ disabled: busy }}
            onPress={onBack}
            style={s.back}
          >
            <Text style={s.arrow}>←</Text>
          </Pressable>
          {title && (
            <Text accessibilityRole="header" style={s.headerText}>
              {title}
            </Text>
          )}
        </View>
        <ScrollView
          ref={scroll}
          onContentSizeChange={revealStatus}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.content}
        >
          {children}
          <View style={s.space} />
          <View style={s.footer} onLayout={revealStatus}>
            {!!error && (
              <Text
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                style={s.error}
              >
                {error}
              </Text>
            )}
            <Button
              label={label}
              busy={busy}
              disabled={disabled}
              onPress={onSubmit}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </NightScreen>
  );
}
export const signupStyles = StyleSheet.create({
  title: {
    fontFamily: theme.font,
    fontSize: 22,
    lineHeight: 31,
    fontWeight: '700',
    color: theme.color.text,
  },
  body: {
    fontFamily: theme.font,
    fontSize: 14,
    lineHeight: 21,
    color: theme.color.muted,
  },
  caption: {
    fontFamily: theme.font,
    fontSize: 11,
    lineHeight: 17,
    color: theme.color.muted,
  },
  group: { gap: 14 },
});
const s = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 52,
    paddingHorizontal: 8,
  },
  back: {
    minWidth: 40,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrow: {
    fontFamily: theme.font,
    fontSize: 24,
    lineHeight: 32,
    includeFontPadding: false,
    color: theme.color.text,
  },
  headerText: {
    fontFamily: theme.font,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    color: theme.color.text,
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 14,
  },
  space: { flex: 1, minHeight: 30 },
  footer: { gap: 14 },
  error: {
    fontFamily: theme.font,
    fontSize: 13,
    lineHeight: 21,
    color: theme.color.error,
    backgroundColor: '#1E2063',
    padding: 12,
  },
});

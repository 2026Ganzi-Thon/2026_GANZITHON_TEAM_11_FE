import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../ui/Button';
import { theme } from '../../ui/theme';
import { openSupportResource } from './device';
import { readSupport, supportTarget, type SupportResource } from './model';
type Props = {
  support: unknown;
  onReturn: () => void;
  openResource?: (resource: SupportResource) => Promise<void>;
};
/** Compose inside the writing screen's scroll area so the writing session stays alive. */
export function SupportContent(props: Props) {
  const support = readSupport(props.support);
  return (
    <SupportSession key={JSON.stringify(support)} {...props} data={support} />
  );
}
function SupportSession({
  data,
  onReturn,
  openResource = openSupportResource,
}: Props & { data: ReturnType<typeof readSupport> }) {
  const [pending, setPending] = useState<number | null>(null);
  const [failed, setFailed] = useState<number | null>(null);
  const active = useRef(true);
  const request = useRef<object | null>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      request.current = null;
    };
  }, []);
  async function open(resource: SupportResource, index: number) {
    if (
      !active.current ||
      request.current ||
      !supportTarget(resource, Platform.OS)
    )
      return;
    const token = {};
    request.current = token;
    setPending(index);
    setFailed(null);
    try {
      await openResource(resource);
    } catch {
      if (active.current && request.current === token) setFailed(index);
    } finally {
      if (active.current && request.current === token) {
        request.current = null;
        setPending(null);
      }
    }
  }
  return (
    <View style={styles.content}>
      <View style={styles.panel}>
        <Text style={styles.title} accessibilityRole="header">
          제출을 잠시 멈췄어요
        </Text>
        {data ? (
          <Text style={styles.body}>{data.message}</Text>
        ) : (
          <Text style={styles.body} accessibilityRole="alert">
            도움 안내를 불러오지 못했어요. 쓰던 글로 돌아가 다시 요청할 수
            있어요.
          </Text>
        )}
        <Text style={styles.caption}>
          작성 내용과 선택한 분류·곡은 그대로 남아 있어요.
        </Text>
      </View>
      {data && (
        <View style={styles.panel}>
          <Text style={styles.section} accessibilityRole="header">
            도움받을 곳
          </Text>
          {data.resources.length === 0 && (
            <Text style={styles.body}>
              지금 표시할 지원 항목이 없어요. 쓰던 글로 돌아갈 수 있어요.
            </Text>
          )}
          {data.resources.map((resource, index) => {
            const available = !!supportTarget(resource, Platform.OS);
            return (
              <View key={index} style={styles.resource}>
                {failed === index && (
                  <Text
                    style={styles.error}
                    accessibilityRole="alert"
                    accessibilityLiveRegion="polite"
                  >
                    앱을 열지 못했어요. 다시 눌러 시도하거나 다른 도움 항목을
                    선택해 주세요.
                  </Text>
                )}
                {pending === index && (
                  <Text style={styles.body} accessibilityLiveRegion="polite">
                    앱을 여는 중이에요.
                  </Text>
                )}
                {!available && (
                  <Text style={styles.caption}>
                    이 기기에서 열 수 없는 항목이에요.
                  </Text>
                )}
                <Button
                  label={resource.label}
                  onPress={() => void open(resource, index)}
                  disabled={!available || pending !== null}
                  busy={pending === index}
                />
              </View>
            );
          })}
          <Text style={styles.caption}>
            전화 버튼은 전화 앱을 열어요. 직접 통화를 시작하기 전에는 전화가
            걸리지 않아요. 연락처는 기기의 연락처 앱에서 확인하며 이 앱으로
            가져오지 않아요.
          </Text>
        </View>
      )}
      <Text style={styles.preview}>
        고정 예시 안내 · 도움 버튼은 기기의 앱을 열어요. 실제 안전 검사와
        연결되지 않았어요.
      </Text>
      <Button
        label="쓰던 글로 돌아가기"
        onPress={() => {
          active.current = false;
          request.current = null;
          onReturn();
        }}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  content: { gap: 20 },
  panel: {
    padding: 20,
    gap: 16,
    backgroundColor: theme.color.panel,
    borderRadius: theme.radius,
  },
  title: {
    fontFamily: theme.font,
    fontSize: 22,
    lineHeight: 34,
    fontWeight: '700',
    color: theme.color.text,
  },
  section: {
    fontFamily: theme.font,
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '700',
    color: theme.color.text,
  },
  body: {
    fontFamily: theme.font,
    fontSize: 16,
    lineHeight: 26,
    color: theme.color.text,
  },
  caption: {
    fontFamily: theme.font,
    fontSize: 14,
    lineHeight: 23,
    color: theme.color.muted,
  },
  error: {
    fontFamily: theme.font,
    fontSize: 16,
    lineHeight: 26,
    color: theme.color.error,
  },
  resource: { gap: 12 },
  preview: {
    fontFamily: theme.font,
    fontSize: 13,
    lineHeight: 22,
    color: theme.color.muted,
  },
});

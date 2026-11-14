import { useEffect, useState } from 'react';
import {
  BackHandler,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button } from '../../ui/Button';
import { NightScreen } from '../../ui/NightScreen';
import { theme } from '../../ui/theme';
import { categories } from '../night/categories';
import { TextCardScreen } from './TextCardScreen';
import { SongCardScreen } from './SongCardScreen';
import type { TextCardActions, TextCardCategory } from './types';
import type { SongCardActions } from './songTypes';
export interface CardChoice {
  category_id: TextCardCategory;
  kind: 'text' | 'song';
}
export interface CardWritingActions {
  text: TextCardActions;
  song: SongCardActions;
  readChoice(): CardChoice | null;
  choose(value: CardChoice): void;
}
type CardWritingProps = {
  actions: CardWritingActions;
  onBack: () => void;
  onDone: () => void;
  modal?: boolean;
} & (
  | { entryContext: 'my_cards'; sourceNightId?: never }
  | { entryContext?: 'night_offer' | 'morning_banner'; sourceNightId: string }
);
export function CardWritingScreen(
  props: Parameters<typeof CardWritingSession>[0],
) {
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
  return <CardWritingSession key={source.version} {...props} />;
}
function CardWritingSession({
  actions,
  sourceNightId,
  onBack,
  onDone,
  modal = false,
  entryContext = 'night_offer',
}: CardWritingProps) {
  const [context] = useState(entryContext);
  const completionLabel =
    context === 'my_cards'
      ? '내 카드로'
      : context === 'morning_banner'
        ? '아침 홈으로'
        : '이제 잘게요';
  const [choice, setChoice] = useState(() => actions.readChoice());
  const [category, setCategory] = useState<TextCardCategory | null>(
    choice?.category_id ?? null,
  );
  const [kind, setKind] = useState<'text' | 'song'>(choice?.kind ?? 'text');
  const [page, setPage] = useState<'choose' | 'text' | 'song'>(
    choice?.kind ?? 'choose',
  );
  useEffect(() => {
    if (page !== 'choose') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [page, onBack]);
  const common = {
    sourceNightId,
    onDone,
    modal,
    completionLabel,
    conflictTitle:
      context === 'my_cards' ? '작성 상태를 확인해 주세요' : undefined,
    onBack: () => setPage('choose'),
  };
  if (page === 'text')
    return (
      <TextCardScreen {...common} actions={actions.text} externalCategory />
    );
  if (page === 'song')
    return <SongCardScreen {...common} actions={actions.song} />;
  const next = () => {
    if (!category) return;
    const selected = { kind, category_id: category };
    actions.choose(selected);
    setChoice(selected);
    if (kind === 'text')
      actions.text.writeDraft({
        ...actions.text.readDraft(),
        category_id: category,
      });
    else
      actions.song.writeDraft({
        ...actions.song.readDraft(),
        category_id: category,
      });
    setPage(kind);
  };
  const content = (
    <NightScreen
      background={require('../../../assets/images/my-cards/background.svg')}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="이전"
          onPress={onBack}
          style={styles.back}
        >
          <Text style={styles.arrow}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>카드 쓰기</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          누구에게 남길까요?
        </Text>
        <View style={styles.chips}>
          {categories
            .filter((c) => c.id !== 'none')
            .map((c) => (
              <Pressable
                key={c.id}
                accessibilityRole="radio"
                accessibilityLabel={c.label}
                accessibilityState={{ checked: category === c.id }}
                onPress={() => setCategory(c.id as TextCardCategory)}
                style={[styles.chip, category === c.id && styles.selected]}
              >
                <Text
                  style={[
                    styles.label,
                    category === c.id && styles.selectedLabel,
                  ]}
                >
                  {c.label}
                </Text>
              </Pressable>
            ))}
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          어떤 카드로 남길까요?
        </Text>
        {(['text', 'song'] as const).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityLabel={value === 'text' ? '짧은 글' : '노래 추천'}
            accessibilityState={{ checked: kind === value }}
            onPress={() => setKind(value)}
            style={[styles.kind, kind === value && styles.selected]}
          >
            <Text
              style={[styles.kindLabel, kind === value && styles.selectedLabel]}
            >
              {value === 'text' ? '짧은 글' : '노래 추천'}
            </Text>
          </Pressable>
        ))}
        <View style={styles.spacer} />
        <Button label="다음" disabled={!category} onPress={next} />
      </ScrollView>
    </NightScreen>
  );
  return modal ? (
    <Modal
      visible
      animationType="none"
      onRequestClose={onBack}
      testID="card-writing-modal"
    >
      {content}
    </Modal>
  ) : (
    content
  );
}
const styles = StyleSheet.create({
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
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 14,
  },
  title: {
    fontFamily: theme.font,
    fontSize: 22,
    lineHeight: 31,
    fontWeight: '700',
    color: theme.color.text,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 8,
    justifyContent: 'center',
    backgroundColor: '#2B3591',
  },
  label: {
    fontFamily: theme.font,
    color: theme.color.text,
    fontSize: 13,
    lineHeight: 20,
  },
  kind: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'center',
    backgroundColor: '#2B3591',
    boxShadow: '4px 4px 0 #0E1040',
  },
  kindLabel: {
    fontFamily: theme.font,
    color: theme.color.text,
    fontSize: 15,
    lineHeight: 24,
  },
  selected: {
    backgroundColor: theme.color.primary,
    boxShadow: '3px 3px 0 #8E6BC4',
  },
  selectedLabel: { color: '#242565', fontWeight: '700' },
  spacer: { flexGrow: 1 },
});

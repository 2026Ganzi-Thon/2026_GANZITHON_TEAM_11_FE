import { YarnControl, type YarnControlProps } from '../../yarn/YarnControl';
import { FluffControl, type FluffControlProps } from '../../fluff/FluffControl';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { sentenceLines } from '../../../ui/sentences';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type { Card } from '../../../api/contracts';
import { theme } from '../../../ui/theme';
import { Art, PaperArtwork, SleepingSheep } from './artwork';
import { SongArtwork } from './SongArtwork';

function Reactions({
  warm,
  expanded,
  yarn,
  fluff,
  inline = false,
}: {
  inline?: boolean;
  warm: boolean;
  expanded: boolean;
  yarn?: YarnControlProps;
  fluff?: FluffControlProps;
}) {
  return (
    <View
      style={
        inline
          ? styles.inlineReactions
          : expanded
            ? [styles.expandedReactions, warm && styles.warmReactions]
            : styles.reactions
      }
    >
      {fluff ? (
        <FluffControl {...fluff} warm={warm} expanded={expanded} />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="솜털 보내기 · 준비 중"
          accessibilityState={{ disabled: true }}
          disabled
          style={[styles.reaction, expanded && styles.expandedReaction]}
        >
          <Image
            source={require('../../../../assets/images/feed/fluff.svg')}
            style={styles.icon}
            accessible={false}
          />
          <Text style={[styles.reactionLabel, warm && styles.pale]}>
            솜털 보내기
          </Text>
          <Text style={[styles.pendingLabel, warm && styles.pale]}>
            준비 중
          </Text>
        </Pressable>
      )}
      {yarn ? (
        <YarnControl {...yarn} warm={warm} expanded={expanded} />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="털실 보내기 · 준비 중"
          accessibilityState={{ disabled: true }}
          disabled
          style={styles.reaction}
        >
          <Image
            source={require('../../../../assets/images/feed/yarn.svg')}
            style={styles.icon}
            accessible={false}
          />
          <Text style={[styles.reactionLabel, warm && styles.pale]}>
            털실 보내기
          </Text>
          <Text style={[styles.pendingLabel, warm && styles.pale]}>
            준비 중
          </Text>
        </Pressable>
      )}
    </View>
  );
}
export function FeedCard({
  card,
  isLast,
  yarn,
  fluff,
  songHeight = 340,
  onScrollableChange,
}: {
  songHeight?: number;
  onScrollableChange?: (scrollable: boolean) => void;
  card: Card;
  isLast: boolean;
  yarn?: YarnControlProps;
  fluff?: FluffControlProps;
}) {
  const { fontScale } = useWindowDimensions();
  const expanded = !!(yarn || fluff) && fontScale > 1.3;
  const [bodyHeight, setBodyHeight] = useState<number | null>(null),
    [contentHeight, setContentHeight] = useState<number | null>(null);
  const scrollable =
    bodyHeight === null ||
    contentHeight === null ||
    contentHeight > bodyHeight + 1;
  useEffect(() => {
    onScrollableChange?.(card.available && !!card.content ? scrollable : false);
  }, [onScrollableChange, card.available, card.content, scrollable]);
  if (!card.available || !card.content)
    return (
      <View style={[styles.card, styles.unavailable]}>
        <Text accessibilityRole="header" style={styles.unavailableTitle}>
          지금은 볼 수 없는 카드예요
        </Text>
        <Text style={styles.unavailableText}>
          다음 양으로 넘어갈 수 있어요.
        </Text>
      </View>
    );
  const warm = card.kind === 'text' && card.tone === 'warm';
  const postcard =
    card.kind === 'text' && card.author_type === 'mongchi' && !warm;
  const automatic = card.author_type === 'ai';
  if (card.kind === 'song') {
    const height = fontScale > 1.3 ? 470 : songHeight;
    const artScale = height < 280 ? 0.3 : 0.65;
    return (
      <View style={[styles.card, { height }]}>
        <PaperArtwork kind="jacket" height={height} />
        <View style={styles.songLayout}>
          <Text style={[styles.songTag, styles.flowTag]}>
            {automatic ? 'AI 선곡' : '사용자 추천'}
          </Text>
          <SongArtwork
            key={`${card.id}:${card.content.track.cover_url}`}
            track={card.content.track}
            scale={artScale}
          />
          <ScrollView
            testID="feed-card-content"
            nestedScrollEnabled
            scrollEnabled={scrollable}
            style={styles.songCopy}
            onLayout={(e) => setBodyHeight(e.nativeEvent.layout.height)}
            onContentSizeChange={(_w, h) => setContentHeight(h)}
          >
            <Text style={styles.compactSongTitle}>
              {card.content.track.title}
            </Text>
            <Text style={styles.compactArtist}>
              {card.content.track.artist}
            </Text>
            {!automatic && (
              <Text style={styles.compactRecommendation}>
                {sentenceLines(card.content.recommendation ?? '')}
              </Text>
            )}
            {!automatic && card.author_label && (
              <Text style={styles.compactArtist}>— {card.author_label}</Text>
            )}
          </ScrollView>
          <Reactions
            warm={false}
            expanded={expanded}
            inline
            yarn={yarn}
            fluff={fluff}
          />
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.card, expanded && styles.growingCard]}>
      {expanded && <View style={styles.paperSpace} />}
      {warm ? (
        <SleepingSheep />
      ) : (
        <PaperArtwork kind={postcard ? 'postcard' : 'paper'} />
      )}
      <>
        {warm ? (
          <Text style={styles.warmTag}>
            {isLast ? '따뜻한 말 · 오늘의 마지막 양' : '따뜻한 말'}
          </Text>
        ) : (
          <Text style={[styles.tag, postcard && styles.postcardTag]}>
            {postcard ? '뭉치' : card.tone === 'light' ? '가벼운' : '공감'}
          </Text>
        )}
        {postcard && (
          <>
            <View
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
              accessible={false}
            >
              <Art
                source={require('../../../../assets/images/feed/stamp.svg')}
                x={219}
                y={17}
                width={82}
                height={94}
              />
              <View style={styles.stampSky} />
              <View style={styles.stampHill} />
              <View style={styles.stampMoon} />
              <Art
                source={require('../../../../assets/images/feed/jump-sheep.svg')}
                x={232}
                y={58}
                width={44}
                height={37}
              />
              <Art
                source={require('../../../../assets/images/feed/postmark.svg')}
                x={180}
                y={56}
                width={59}
                height={59}
              />
              <Text style={styles.postmark}>예시</Text>
            </View>
            <Text style={styles.to}>to. 잠 못 드는 너</Text>
          </>
        )}
        <ScrollView
          testID="feed-card-content"
          nestedScrollEnabled
          scrollEnabled={scrollable}
          onLayout={(e) => setBodyHeight(e.nativeEvent.layout.height)}
          onContentSizeChange={(_w, h) => setContentHeight(h)}
          style={[
            styles.body,
            warm && styles.warmBody,
            postcard && styles.postcardBody,
          ]}
          contentContainerStyle={
            !warm && !postcard ? styles.bodyContent : undefined
          }
        >
          <Text
            style={[
              styles.bodyText,
              warm && styles.warmText,
              postcard && styles.postcardText,
            ]}
          >
            {sentenceLines(card.content.text)}
          </Text>
        </ScrollView>
        {!warm && !postcard && <View style={styles.signature} />}
        {card.author_label && (
          <Text
            style={[
              styles.author,
              warm && styles.warmAuthor,
              postcard && styles.postcardAuthor,
            ]}
          >
            {postcard ? `from. ${card.author_label}` : `— ${card.author_label}`}
          </Text>
        )}
      </>
      <Reactions warm={warm} expanded={expanded} yarn={yarn} fluff={fluff} />
    </View>
  );
}
const styles = StyleSheet.create({
  inlineReactions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  songLayout: { flex: 1, paddingHorizontal: 18, paddingVertical: 10, gap: 5 },
  flowTag: { position: 'relative', top: 0, left: 0, alignSelf: 'flex-start' },
  songCopy: { flex: 1 },
  compactSongTitle: {
    fontFamily: theme.font,
    color: theme.color.background,
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '700',
  },
  compactArtist: {
    fontFamily: theme.font,
    color: '#4A5290',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  compactRecommendation: {
    fontFamily: theme.font,
    color: theme.color.background,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
  },
  card: { width: 318, height: 470, alignSelf: 'center' },
  growingCard: { height: undefined },
  paperSpace: { height: 470 },
  expandedReactions: {
    padding: 12,
    gap: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    backgroundColor: '#FFF4D6',
  },
  expandedReaction: { width: 132 },
  warmReactions: { backgroundColor: theme.color.panel },
  unavailable: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 22,
    borderWidth: 1,
    borderColor: '#4A5BC2',
    borderRadius: 4,
  },
  unavailableTitle: {
    fontFamily: theme.font,
    color: theme.color.text,
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '700',
  },
  unavailableText: {
    fontFamily: theme.font,
    color: theme.color.muted,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 12,
  },
  tag: {
    position: 'absolute',
    left: 20,
    top: 24,
    backgroundColor: '#CFDBFA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontFamily: theme.font,
    fontWeight: '700',
    color: theme.color.background,
    fontSize: 11,
    lineHeight: 16,
    includeFontPadding: false,
  },
  postcardTag: { backgroundColor: '#B7E3CC' },
  body: { position: 'absolute', left: 22, top: 70, width: 274, height: 244 },
  bodyContent: { paddingTop: 40, paddingBottom: 12 },
  bodyText: {
    fontFamily: theme.font,
    color: theme.color.background,
    fontSize: 18,
    lineHeight: 30,
    includeFontPadding: false,
  },
  signature: {
    position: 'absolute',
    left: 22,
    top: 326,
    width: 110,
    height: 2,
    backgroundColor: '#E2D3A6',
  },
  author: {
    position: 'absolute',
    left: 22,
    top: 336,
    width: 274,
    fontFamily: theme.font,
    color: '#8C6E62',
    fontSize: 13,
    lineHeight: 20,
  },
  reactions: {
    position: 'absolute',
    left: 158,
    top: 396,
    flexDirection: 'row',
    gap: 0,
  },
  reaction: { width: 70, alignItems: 'center', opacity: 0.65 },
  icon: { width: 44, height: 44 },
  reactionLabel: {
    fontFamily: theme.font,
    color: '#4A5290',
    fontSize: 10,
    lineHeight: 14,
    includeFontPadding: false,
  },
  pendingLabel: {
    fontFamily: theme.font,
    color: '#4A5290',
    fontSize: 9,
    lineHeight: 13,
    includeFontPadding: false,
  },
  pale: { color: theme.color.muted },
  songTag: {
    position: 'absolute',
    left: 18,
    top: 16,
    backgroundColor: theme.color.background,
    color: '#FFE7A3',
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontFamily: theme.font,
    fontWeight: '700',
    fontSize: 11,
    lineHeight: 16,
    includeFontPadding: false,
  },
  warmTag: {
    position: 'absolute',
    left: 8,
    top: 14,
    fontFamily: theme.font,
    fontWeight: '700',
    color: theme.color.primary,
    fontSize: 12,
    lineHeight: 18,
  },
  warmBody: { left: 8, top: 50, width: 296, height: 146 },
  warmText: {
    color: '#FFF4D6',
    fontSize: 22,
    lineHeight: 34,
    fontWeight: '700',
  },
  warmAuthor: { left: 8, top: 210, color: theme.color.muted },
  postcardBody: { top: 176, height: 136 },
  postcardText: { fontSize: 20, lineHeight: 32, fontWeight: '700' },
  postcardAuthor: { top: 326, textAlign: 'right', color: '#4A5290' },
  to: {
    position: 'absolute',
    left: 22,
    top: 62,
    fontFamily: theme.font,
    color: '#8C6E62',
    fontSize: 13,
    lineHeight: 20,
  },
  stampSky: {
    position: 'absolute',
    left: 228,
    top: 26,
    width: 64,
    height: 52,
    backgroundColor: '#2E3E9E',
  },
  stampHill: {
    position: 'absolute',
    left: 228,
    top: 78,
    width: 64,
    height: 24,
    backgroundColor: '#172066',
  },
  stampMoon: {
    position: 'absolute',
    left: 272,
    top: 34,
    width: 10,
    height: 10,
    backgroundColor: '#EDE4F7',
  },
  postmark: {
    position: 'absolute',
    left: 192,
    top: 77,
    width: 32,
    textAlign: 'center',
    fontFamily: theme.font,
    color: '#8C6E62',
    fontSize: 10,
    lineHeight: 16,
  },
});

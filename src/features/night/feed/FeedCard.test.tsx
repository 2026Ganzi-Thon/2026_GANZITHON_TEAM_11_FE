import { describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { Card } from '../../../api/contracts';
import { FeedCard } from './FeedCard';
const base = {
  id: 'c1',
  available: true,
  category_id: null,
  author_type: 'user',
  author_label: '먼저 지나간 양',
  viewer: { yarn_sent: false, fluff_saved: false, song_saved: false },
} as const;
const textCard: Card = {
  ...base,
  kind: 'text',
  tone: 'empathy',
  content: { text: '예시 고민에 건네는 말' },
};
const songCard: Card = {
  ...base,
  kind: 'song',
  tone: null,
  content: {
    track: {
      id: 't1',
      title: '예시 곡',
      artist: '예시 가수',
      cover_url: null,
      spotify_search_url: '',
    },
    recommendation: '잠깐 쉬면서 들었어',
  },
};
describe('feed card rendering', () => {
  it('hides unavailable content and keeps its slot readable', async () => {
    await render(
      <FeedCard card={{ ...textCard, available: false }} isLast={false} />,
    );
    expect(screen.queryByText('예시 고민에 건네는 말')).toBeNull();
    expect(screen.getByText('지금은 볼 수 없는 카드예요')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /털실/ })).toBeNull();
  });
  it('handles a null body without crashing', async () => {
    await render(
      <FeedCard card={{ ...songCard, content: null }} isLast={false} />,
    );
    expect(screen.getByText('지금은 볼 수 없는 카드예요')).toBeTruthy();
  });
  it('shows text and attribution with unavailable reaction controls clearly disabled', async () => {
    await render(<FeedCard card={textCard} isLast={false} />);
    expect(screen.getByText('예시 고민에 건네는 말')).toBeTruthy();
    expect(screen.getByText('— 먼저 지나간 양')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: '털실 보내기 · 준비 중' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: '솜털 보내기 · 준비 중' }),
    ).toBeDisabled();
  });
  it('hides generated song recommendation and attribution, even if supplied', async () => {
    await render(
      <FeedCard card={{ ...songCard, author_type: 'ai' }} isLast={false} />,
    );
    expect(screen.getByText('예시 곡')).toBeTruthy();
    expect(screen.getByText('예시 가수')).toBeTruthy();
    expect(screen.queryByText('잠깐 쉬면서 들었어')).toBeNull();
    expect(screen.queryByText('— 먼저 지나간 양')).toBeNull();
    expect(screen.queryByRole('button', { name: /재생/ })).toBeNull();
  });
  it('shows user song recommendation and replaces a failed cover with local art', async () => {
    if (songCard.kind !== 'song' || !songCard.content) throw Error('fixture');
    await render(
      <FeedCard
        card={{
          ...songCard,
          content: {
            ...songCard.content,
            track: {
              ...songCard.content.track,
              cover_url: 'https://example.invalid/cover.png',
            },
          },
        }}
        isLast={false}
      />,
    );
    expect(screen.getByText('잠깐 쉬면서 들었어')).toBeTruthy();
    await fireEvent(screen.getByLabelText('예시 곡 앨범 표지'), 'error', {
      nativeEvent: { error: 'load failed' },
    });
    expect(screen.getByLabelText('앨범 표지 없음')).toBeTruthy();
  });
  it('labels a warm card as final only at the last slot', async () => {
    const warm: Card = { ...textCard, tone: 'warm' };
    await render(<FeedCard card={warm} isLast={false} />);
    expect(screen.queryByText(/오늘의 마지막 양/)).toBeNull();
    await screen.rerender(<FeedCard card={warm} isLast />);
    expect(screen.getByText(/오늘의 마지막 양/)).toBeTruthy();
  });
});

import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Animated } from 'react-native';
import type { Card } from '../../../api/contracts';
import { FeedScreen } from './FeedScreen';
import type { FeedLoad } from './model';
const cards: Card[] = Array.from({ length: 3 }, (_, i) => ({
  id: `c${i}`,
  kind: 'text',
  tone: i === 2 ? 'warm' : 'empathy',
  category_id: null,
  author_type: 'seed',
  author_label: '먼저 지나간 양',
  content: { text: `카드 ${i + 1}` },
  available: true,
  viewer: { yarn_sent: false, fluff_saved: false, song_saved: false },
}));
const press = (label: string) =>
  fireEvent.press(screen.getByRole('button', { name: label }));
afterEach(() => {
  jest.restoreAllMocks();
});
function reduced() {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
}
describe('feed preview interaction', () => {
  it('starts at 1, preserves order, bounds movement, and finishes without claiming persistence', async () => {
    reduced();
    await render(<FeedScreen load={async () => cards} onBack={() => {}} />);
    expect(screen.getByText('1 / 3')).toBeTruthy();
    expect(screen.getByText('카드 1')).toBeTruthy();
    expect(screen.getByRole('button', { name: '이전 양' })).toBeDisabled();
    await press('다음 양');
    expect(screen.getByText('2 / 3')).toBeTruthy();
    await press('이전 양');
    expect(screen.getByText('1 / 3')).toBeTruthy();
    await press('다음 양');
    await press('다음 양');
    expect(screen.getByText('3 / 3')).toBeTruthy();
    expect(screen.getByText('카드 3')).toBeTruthy();
    await press('미리보기 마치기');
    expect(screen.getByText('피드 미리보기를 마쳤어요')).toBeTruthy();
    expect(
      screen.getByText(/실제 진행·종료 기록은 저장하지 않았어요/),
    ).toBeTruthy();
  });
  it('blocks rapid moves until animation completion and never commits a cancelled animation', async () => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(false);
    let finish: ((result: { finished: boolean }) => void) | undefined;
    const stop = jest.fn();
    jest.spyOn(Animated, 'timing').mockImplementation(() => ({
      start: (cb) => {
        finish = cb;
      },
      stop,
      reset: () => {},
    }));
    const onBack = jest.fn();
    await render(<FeedScreen load={async () => cards} onBack={onBack} />);
    await press('다음 양');
    await press('다음 양');
    expect(screen.getByText('1 / 3')).toBeTruthy();
    await act(async () => finish?.({ finished: true }));
    expect(screen.getByText('2 / 3')).toBeTruthy();
    await press('다음 양');
    await press('미리보기 나가기');
    expect(stop).toHaveBeenCalled();
    expect(onBack).toHaveBeenCalledTimes(1);
    await act(async () => finish?.({ finished: true }));
    expect(screen.getByText('2 / 3')).toBeTruthy();
  });
  it('shows a safe load error and recovers on retry', async () => {
    reduced();
    const load = jest
      .fn<FeedLoad>()
      .mockRejectedValueOnce(new Error('private error'))
      .mockResolvedValue(cards);
    await render(<FeedScreen load={load} onBack={() => {}} />);
    expect(screen.queryByText('private error')).toBeNull();
    await press('다시 시도');
    expect(screen.getByText('카드 1')).toBeTruthy();
  });
  it('does not show progress or next controls for an empty feed', async () => {
    reduced();
    await render(<FeedScreen load={async () => []} onBack={() => {}} />);
    expect(screen.getByText('표시할 카드가 없어요')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '다음 양' })).toBeNull();
  });
  it('aborts loading on leaving and ignores late responses', async () => {
    reduced();
    let resolve!: (value: Card[]) => void;
    const load = jest.fn<FeedLoad>().mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    await render(<FeedScreen load={load} onBack={() => {}} />);
    expect(screen.getByText('카드를 불러오고 있어요')).toBeTruthy();
    await press('미리보기 나가기');
    expect(load.mock.calls[0][0].aborted).toBe(true);
    await act(async () => resolve(cards));
    expect(screen.queryByText('카드 1')).toBeNull();
  });
  it('does not accept an old load after the supplied loader changes', async () => {
    reduced();
    let resolve!: (value: Card[]) => void;
    const old = jest.fn<FeedLoad>().mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    await render(<FeedScreen load={old} onBack={() => {}} />);
    await screen.rerender(
      <FeedScreen load={async () => [cards[2]]} onBack={() => {}} />,
    );
    expect(old).toHaveBeenCalledTimes(1);
    expect(old.mock.calls[0][0].aborted).toBe(true);
    await act(async () => resolve(cards));
    expect(screen.getByText('카드 3')).toBeTruthy();
    expect(screen.queryByText('카드 1')).toBeNull();
  });
});

import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { AccessibilityInfo, BackHandler, Text } from 'react-native';
import { FeedScreen } from '../feed/FeedScreen';
import { NightEntryScreen } from '../NightEntryScreen';
import type { Card } from '../../../api/contracts';
import type { ClosingActions } from './types';
import NightClosingPreview from '../../../app/dev/night-closing';
const cards: Card[] = Array.from({ length: 3 }, (_, i) => ({
  id: `card-${i}`,
  kind: 'text',
  tone: i === 2 ? 'warm' : 'empathy',
  content: { text: `본문 ${i}` },
  author_type: 'seed',
  author_label: null,
  category_id: null,
  available: true,
  viewer: { yarn_sent: false, fluff_saved: false, song_saved: false },
}));
function actions(): ClosingActions {
  return {
    finish: jest.fn<ClosingActions['finish']>().mockResolvedValue({
      summary: { counted: 3, entrusted_count: 0, fluff_count: 0 },
      closing_card: null,
      writing_offer: { state: 'offered' },
    }),
    markViewed: jest
      .fn<ClosingActions['markViewed']>()
      .mockResolvedValue(undefined),
    chooseWriting: jest
      .fn<ClosingActions['chooseWriting']>()
      .mockResolvedValue(undefined),
  };
}
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
const originalDev = __DEV__;
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
  Object.defineProperty(globalThis, '__DEV__', {
    value: originalDev,
    configurable: true,
  });
});
describe('feed to closing preview', () => {
  it('passes a completed snapshot only from the last card', async () => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(true);
    const api = actions();
    await render(
      <FeedScreen
        load={async () => cards}
        onBack={() => {}}
        closingActions={api}
      />,
    );
    expect(screen.queryByRole('button', { name: '마무리하기' })).toBeNull();
    await press('다음 양');
    await press('다음 양');
    await press('마무리하기');
    expect(api.finish).toHaveBeenCalledWith(
      { reason: 'completed', position: 3, furthestPosition: 3, sheepCount: 3 },
      expect.any(String),
      expect.any(AbortSignal),
    );
    expect(screen.getByText('3마리 다 셌어요')).toBeTruthy();
  });
  it('preserves the maximum position when leaving after moving backward', async () => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(true);
    const api = actions();
    await render(
      <FeedScreen
        load={async () => cards}
        onBack={() => {}}
        closingActions={api}
      />,
    );
    await press('다음 양');
    await press('다음 양');
    await press('이전 양');
    await press('그만 세고 싶어요');
    expect(api.finish).toHaveBeenCalledWith(
      { reason: 'leave', position: 2, furthestPosition: 3, sheepCount: 3 },
      expect.any(String),
      expect.any(AbortSignal),
    );
  });
  it('leaves without finishing on hardware back', async () => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(true);
    let back: Parameters<typeof BackHandler.addEventListener>[1] | undefined;
    jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((_event, cb) => {
        back = cb;
        return { remove: jest.fn() };
      });
    const api = actions();
    const onBack = jest.fn();
    await render(
      <FeedScreen
        load={async () => cards}
        onBack={onBack}
        closingActions={api}
      />,
    );
    await act(async () => {
      back?.({ type: 'hardwareBackPress', timeStamp: 0 });
    });
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(api.finish).not.toHaveBeenCalled();
  });
  it('does not finish merely by unmounting the feed', async () => {
    const api = actions();
    await render(
      <FeedScreen
        load={async () => cards}
        onBack={() => {}}
        closingActions={api}
      />,
    );
    await screen.unmount();
    expect(api.finish).not.toHaveBeenCalled();
  });
  it('redirects the closing gallery in release mode', async () => {
    Object.defineProperty(globalThis, '__DEV__', {
      value: false,
      configurable: true,
    });
    const result = await renderRouter(
      {
        index: () => <Text>시작</Text>,
        'dev/night-closing': NightClosingPreview,
      },
      { initialUrl: '/dev/night-closing' },
    );
    expect(result.getPathname()).toBe('/');
  });
  it('enters a selected gallery scenario', async () => {
    jest.useFakeTimers();
    Object.defineProperty(globalThis, '__DEV__', {
      value: true,
      configurable: true,
    });
    await renderRouter(
      {
        index: () => <Text>시작</Text>,
        'dev/night-closing': NightClosingPreview,
      },
      { initialUrl: '/dev/night-closing' },
    );
    await press('완료·중도 종료');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(800);
    });
    expect(screen.getByText('1 / 3')).toBeTruthy();
  });
  it('connects worry entry to closing and returns to the selected count', async () => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(true);
    const api = actions();
    await render(
      <NightEntryScreen
        actions={{ checkWorry: async () => {}, startCounting: async () => {} }}
        onBack={() => {}}
        createFeed={() => async () => cards}
        closingActions={api}
      />,
    );
    await fireEvent.press(screen.getByRole('radio', { name: '고민 없음' }));
    await press('다음');
    await fireEvent.press(screen.getByRole('radio', { name: '3마리' }));
    await press('양 세기 시작');
    await press('다음 양');
    await press('다음 양');
    await press('마무리하기');
    expect(screen.getByText('3마리 다 셌어요')).toBeTruthy();
    await press('미리보기 나가기');
    expect(screen.getByLabelText('선택한 양 수')).toHaveTextContent('3마리');
    expect(api.finish).toHaveBeenCalledTimes(1);
  });
});

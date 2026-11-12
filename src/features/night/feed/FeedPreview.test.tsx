import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { AccessibilityInfo, Text } from 'react-native';
import NightFeedPreview from '../../../app/dev/night-feed';
import { NightEntryScreen } from '../NightEntryScreen';
import { createMockNightFeed } from '../../../mocks/nightFeed';
const originalDev = __DEV__;
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
  Object.defineProperty(globalThis, '__DEV__', {
    value: originalDev,
    configurable: true,
  });
});
describe('feed development integration', () => {
  it('redirects release deep links', async () => {
    Object.defineProperty(globalThis, '__DEV__', {
      value: false,
      configurable: true,
    });
    const result = await renderRouter(
      { index: () => <Text>시작</Text>, 'dev/night-feed': NightFeedPreview },
      { initialUrl: '/dev/night-feed' },
    );
    expect(result.getPathname()).toBe('/');
  });
  it('opens a gallery scenario only after explicit selection', async () => {
    Object.defineProperty(globalThis, '__DEV__', {
      value: true,
      configurable: true,
    });
    jest.useFakeTimers();
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(true);
    await renderRouter(
      { index: () => <Text>시작</Text>, 'dev/night-feed': NightFeedPreview },
      { initialUrl: '/dev/night-feed' },
    );
    expect(screen.queryByText('1 / 6')).toBeNull();
    await fireEvent.press(
      screen.getByRole('button', { name: '카드 유형 6개' }),
    );
    await act(async () => {
      await jest.advanceTimersByTimeAsync(800);
    });
    expect(screen.getByText('1 / 6')).toBeTruthy();
    await fireEvent.press(
      screen.getByRole('button', { name: '미리보기 나가기' }),
    );
    expect(screen.getByRole('button', { name: '카드 유형 6개' })).toBeTruthy();
  });
  it('uses the selected count and preserves worry and count after returning from the feed', async () => {
    jest.useFakeTimers();
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(true);
    await render(
      <NightEntryScreen
        actions={{ checkWorry: async () => {}, startCounting: async () => {} }}
        onBack={() => {}}
        createFeed={createMockNightFeed}
      />,
    );
    await fireEvent.press(screen.getByRole('radio', { name: '취업' }));
    await fireEvent.changeText(
      screen.getByLabelText('오늘의 고민'),
      '가상의 면접 고민',
    );
    await fireEvent.press(screen.getByRole('button', { name: '다음' }));
    await fireEvent.press(screen.getByRole('radio', { name: '3마리' }));
    await fireEvent.press(screen.getByRole('button', { name: '양 세기 시작' }));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(800);
    });
    expect(screen.getByText('1 / 3')).toBeTruthy();
    await fireEvent.press(
      screen.getByRole('button', { name: '미리보기 나가기' }),
    );
    expect(screen.getByLabelText('선택한 양 수')).toHaveTextContent('3마리');
    await fireEvent.press(screen.getByRole('button', { name: '뒤로' }));
    expect(screen.getByLabelText('오늘의 고민')).toHaveDisplayValue(
      '가상의 면접 고민',
    );
  });
});

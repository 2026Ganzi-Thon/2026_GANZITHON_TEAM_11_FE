import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act } from '@testing-library/react-native';
import { Text } from 'react-native';
import { renderRouter, screen, fireEvent } from 'expo-router/testing-library';
import NightEntryPreview from '../../app/dev/night-entry';

const originalDev = __DEV__;
afterEach(() => {
  Object.defineProperty(globalThis, '__DEV__', {
    value: originalDev,
    configurable: true,
  });
});
describe('night preview access', () => {
  it('redirects production deep links to the start screen', async () => {
    Object.defineProperty(globalThis, '__DEV__', {
      value: false,
      configurable: true,
    });
    const result = await renderRouter(
      {
        index: () => <Text>시작 화면</Text>,
        'dev/night-entry': NightEntryPreview,
      },
      { initialUrl: '/dev/night-entry' },
    );
    expect(result.getPathname()).toBe('/');
  });
  it('requires a scenario and discards drafts when leaving the flow', async () => {
    Object.defineProperty(globalThis, '__DEV__', {
      value: true,
      configurable: true,
    });
    await renderRouter(
      {
        index: () => <Text>시작 화면</Text>,
        'dev/night-entry': NightEntryPreview,
      },
      { initialUrl: '/dev/night-entry' },
    );
    expect(screen.queryByLabelText('오늘의 고민')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: '성공 응답' }));
    await fireEvent.press(screen.getByRole('radio', { name: '취업' }));
    await fireEvent.changeText(
      screen.getByLabelText('오늘의 고민'),
      '예시 고민',
    );
    await fireEvent.press(screen.getByRole('button', { name: '뒤로' }));
    expect(
      screen.getByRole('button', { name: '고민 입력 실패 후 재시도' }),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '성공 응답' }));
    expect(screen.getByLabelText('오늘의 고민')).toHaveDisplayValue('');
    expect(screen.getByText('미리보기 · 저장 안 함')).toBeTruthy();
  });
});
it('connects a fixed support scenario through explicit continue and discards it when switching scenarios', async () => {
  jest.useFakeTimers();
  try {
    await renderRouter(
      {
        index: () => <Text>시작 화면</Text>,
        'dev/night-entry': NightEntryPreview,
      },
      { initialUrl: '/dev/night-entry' },
    );
    await fireEvent.press(
      screen.getByRole('button', { name: '도움 안내 → 양 수 선택' }),
    );
    await fireEvent.press(screen.getByRole('radio', { name: '고민 없음' }));
    await fireEvent.press(screen.getByRole('button', { name: '다음' }));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(800);
    });
    expect(screen.getByText('혼자 버티지 않아도 돼요')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '계속하기' }));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(800);
    });
    expect(screen.getByText('오늘은 몇 마리 셀까요?')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '뒤로' }));
    await fireEvent.press(screen.getByRole('button', { name: '뒤로' }));
    await fireEvent.press(screen.getByRole('button', { name: '성공 응답' }));
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
    expect(screen.queryByText('혼자 버티지 않아도 돼요')).toBeNull();
  } finally {
    jest.useRealTimers();
  }
});

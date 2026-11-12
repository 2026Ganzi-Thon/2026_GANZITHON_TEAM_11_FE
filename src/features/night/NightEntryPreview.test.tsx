import { afterEach, describe, expect, it } from '@jest/globals';
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

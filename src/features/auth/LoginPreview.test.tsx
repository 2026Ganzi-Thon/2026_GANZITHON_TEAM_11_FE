import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { Text } from 'react-native';
import {
  act,
  renderRouter,
  screen,
  fireEvent,
} from 'expo-router/testing-library';
import LoginPreview from '../../app/dev/login';

const originalDev = __DEV__;
afterEach(() => {
  Object.defineProperty(globalThis, '__DEV__', {
    value: originalDev,
    configurable: true,
  });
  jest.useRealTimers();
});

describe('login preview access', () => {
  it('redirects a production deep link to the start screen', async () => {
    Object.defineProperty(globalThis, '__DEV__', {
      value: false,
      configurable: true,
    });
    const result = await renderRouter(
      { index: () => <Text>시작 화면</Text>, 'dev/login': LoginPreview },
      { initialUrl: '/dev/login' },
    );
    expect(result.getPathname()).toBe('/');
    expect(screen.getByText('시작 화면')).toBeTruthy();
  });
  it('requires an explicit preview scenario before showing the form', async () => {
    Object.defineProperty(globalThis, '__DEV__', {
      value: true,
      configurable: true,
    });
    await renderRouter(
      { index: () => <Text>시작 화면</Text>, 'dev/login': LoginPreview },
      { initialUrl: '/dev/login' },
    );
    expect(screen.queryByLabelText('비밀번호')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: '성공 응답' }));
    expect(screen.getByLabelText('비밀번호')).toBeTruthy();
    expect(screen.getByText('화면 미리보기 · 실제 로그인 아님')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '뒤로' }));
    expect(screen.getByRole('button', { name: '연결 실패' })).toBeTruthy();
  });
  it('opens recovery through the existing preview and returns to login with email only', async () => {
    jest.useFakeTimers();
    Object.defineProperty(globalThis, '__DEV__', {
      value: true,
      configurable: true,
    });
    await renderRouter(
      { index: () => <Text>시작 화면</Text>, 'dev/login': LoginPreview },
      { initialUrl: '/dev/login' },
    );
    await fireEvent.press(
      screen.getByRole('button', { name: '비밀번호 찾기 · 정상 안내' }),
    );
    await fireEvent.changeText(
      screen.getByLabelText('이메일 주소'),
      'demo@example.com',
    );
    await fireEvent.press(
      screen.getByRole('button', { name: '재설정 메일 보내기' }),
    );
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });
    expect(
      screen.getByRole('header', { name: '메일을 보냈어요' }),
    ).toBeTruthy();
    await fireEvent.press(
      screen.getByRole('button', { name: '로그인으로 돌아가기' }),
    );
    expect(screen.getByLabelText('이메일 주소')).toHaveDisplayValue(
      'demo@example.com',
    );
    expect(screen.getByLabelText('비밀번호')).toHaveDisplayValue('');
  });
});

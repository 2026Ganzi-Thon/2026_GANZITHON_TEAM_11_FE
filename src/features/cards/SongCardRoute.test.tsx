import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { expect, it, jest } from '@jest/globals';
import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';
import Preview from '../../app/dev/song-card';
it('blocks song-card fixtures in release builds', async () => {
  const dev = __DEV__;
  Object.defineProperty(globalThis, '__DEV__', {
    value: false,
    configurable: true,
  });
  try {
    const view = await renderRouter(
      { index: () => <Text>시작</Text>, 'dev/song-card': Preview },
      { initialUrl: '/dev/song-card' },
    );
    expect(view.getPathname()).toBe('/');
  } finally {
    Object.defineProperty(globalThis, '__DEV__', {
      value: dev,
      configurable: true,
    });
  }
});
it('shares the fulfilled night offer across song and text in the standalone preview after a lost receipt', async () => {
  jest.useFakeTimers();
  try {
    await render(<Preview />);
    const press = (name: string) =>
      fireEvent.press(screen.getByRole('button', { name }));
    const tick = () =>
      act(async () => {
        await jest.runAllTimersAsync();
      });
    await press('노래 접수 응답 유실');
    await fireEvent.press(screen.getByRole('radio', { name: '취업' }));
    await fireEvent.press(screen.getByRole('radio', { name: '노래 추천' }));
    await press('다음');
    await fireEvent.changeText(
      screen.getByLabelText('곡 이름 또는 가수 검색'),
      '밤편지',
    );
    await tick();
    await fireEvent.press(
      screen.getByRole('radio', { name: '밤편지 · 아이유' }),
    );
    await fireEvent.changeText(
      screen.getByLabelText('추천 한 줄'),
      '노래 추천',
    );
    await press('검수 요청하기');
    await tick();
    await press('이전');
    await fireEvent.press(screen.getByRole('radio', { name: '짧은 글' }));
    await press('다음');
    await fireEvent.changeText(screen.getByLabelText('짧은 글'), '새 글');
    await press('검수 요청하기');
    await tick();
    expect(screen.getByText('작성할 수 있는 밤을 확인해 주세요')).toBeTruthy();
    expect(screen.queryByText('카드를 맡겼어요')).toBeNull();
  } finally {
    jest.useRealTimers();
  }
});

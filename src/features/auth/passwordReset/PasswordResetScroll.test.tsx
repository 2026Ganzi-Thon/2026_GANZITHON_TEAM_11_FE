import { afterEach, expect, it, jest } from '@jest/globals';
import { ScrollView } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { PasswordResetScreen } from './PasswordResetScreen';
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
const scroller = () =>
  screen.container.queryAll(
    (node) => node.type === 'RCTScrollView' && !!node.props.onContentSizeChange,
  )[0];
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
it('reveals submit feedback but lets the user correct email without automatic scroll jumps', async () => {
  jest.useFakeTimers();
  const scroll = jest.spyOn(ScrollView.prototype, 'scrollToEnd');
  await render(
    <PasswordResetScreen
      actions={{ request: async () => ({ accepted: true }) }}
      onLogin={() => {}}
    />,
  );
  await press('재설정 메일 보내기');
  await act(async () => {
    await jest.advanceTimersByTimeAsync(32);
  });
  expect(scroll).toHaveBeenCalled();
  scroll.mockClear();
  await fireEvent(scroller(), 'focusCapture');
  await fireEvent.changeText(screen.getByLabelText('이메일 주소'), 'u');
  await fireEvent(scroller(), 'contentSizeChange', 320, 900);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(32);
  });
  expect(scroll).not.toHaveBeenCalled();
});
it('does not carry a queued footer scroll into the first mail result screen', async () => {
  jest.useFakeTimers();
  const scroll = jest.spyOn(ScrollView.prototype, 'scrollToEnd');
  await render(
    <PasswordResetScreen
      actions={{ request: async () => ({ accepted: true }) }}
      onLogin={() => {}}
    />,
  );
  await fireEvent.changeText(
    screen.getByLabelText('이메일 주소'),
    'demo@example.com',
  );
  await press('재설정 메일 보내기');
  await fireEvent(scroller(), 'contentSizeChange', 320, 1000);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(32);
  });
  expect(screen.getByRole('header', { name: '메일을 보냈어요' })).toBeTruthy();
  expect(scroll).not.toHaveBeenCalled();
});

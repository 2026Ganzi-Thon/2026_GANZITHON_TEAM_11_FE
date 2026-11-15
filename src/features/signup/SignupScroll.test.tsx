import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { ScrollView } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SignupFlow } from './SignupFlow';
import { createMockSignup } from '../../mocks/signup';
const tick = () =>
  act(async () => {
    await jest.runAllTimersAsync();
  });
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
function scroller() {
  return screen.container.queryAll(
    (node) => node.type === 'RCTScrollView' && !!node.props.onContentSizeChange,
  )[0];
}
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});
it('shows submission feedback but does not scroll away from a field while errors clear and keyboard layout changes', async () => {
  const scroll = jest.spyOn(ScrollView.prototype, 'scrollToEnd');
  scroll.mockClear();
  await render(<SignupFlow actions={createMockSignup()} onExit={() => {}} />);
  await press('이메일로 회원가입');
  await press('다음');
  await tick();
  expect(scroll).toHaveBeenCalled();
  scroll.mockClear();
  await fireEvent(scroller(), 'focusCapture');
  await fireEvent.changeText(screen.getByLabelText('이메일 주소'), 'a');
  await fireEvent(scroller(), 'contentSizeChange', 320, 1200);
  await tick();
  expect(scroll).not.toHaveBeenCalled();
  await fireEvent(scroller(), 'contentSizeChange', 320, 800);
  await tick();
  expect(scroll).not.toHaveBeenCalled();
  expect(screen.getByLabelText('이메일 주소')).toHaveDisplayValue('a');
  await press('다음');
  await tick();
  expect(scroll).toHaveBeenCalled();
});
it('cancels queued feedback scrolling when the user focuses a field before the animation frame', async () => {
  const scroll = jest.spyOn(ScrollView.prototype, 'scrollToEnd');
  scroll.mockClear();
  await render(<SignupFlow actions={createMockSignup()} onExit={() => {}} />);
  await press('이메일로 회원가입');
  await press('다음');
  await fireEvent(scroller(), 'focusCapture');
  await tick();
  expect(scroll).not.toHaveBeenCalled();
});
it('relinquishes automatic scrolling when the user touches or drags the form and cleans up on unmount', async () => {
  const scroll = jest.spyOn(ScrollView.prototype, 'scrollToEnd');
  scroll.mockClear();
  await render(<SignupFlow actions={createMockSignup()} onExit={() => {}} />);
  await press('이메일로 회원가입');
  await press('다음');
  await fireEvent(scroller(), 'touchStartCapture');
  await tick();
  expect(scroll).not.toHaveBeenCalled();
  await press('다음');
  await fireEvent(scroller(), 'scrollBeginDrag');
  await fireEvent(scroller(), 'contentSizeChange', 320, 1000);
  await tick();
  expect(scroll).not.toHaveBeenCalled();
  await press('다음');
  await screen.unmount();
  await tick();
  expect(scroll).not.toHaveBeenCalled();
});

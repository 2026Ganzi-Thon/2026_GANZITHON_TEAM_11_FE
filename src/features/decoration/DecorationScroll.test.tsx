import { afterEach, expect, it, jest } from '@jest/globals';
import { ScrollView } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { DecorationScreen } from './DecorationScreen';
import { createMockMorning } from '../../mocks/morning';
import { createMockDecoration } from '../../mocks/decoration';
const tick = () =>
  act(async () => {
    await jest.runAllTimersAsync();
  });
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
const scrollHost = () =>
  screen.container.queryAll((n) => n.type === 'RCTScrollView')[0];
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
it('reveals failed save feedback after layout without moving the canvas while editing', async () => {
  jest.useFakeTimers();
  const scroll = jest.spyOn(ScrollView.prototype, 'scrollToEnd');
  await render(
    <DecorationScreen
      sheepId="preview-sheep-0"
      actions={createMockDecoration(createMockMorning().loadSheep, {
        scenario: 'save-retry',
      })}
      onSaved={() => {}}
      onBack={() => {}}
    />,
  );
  await tick();
  scroll.mockClear();
  await press('별 스티커 붙이기');
  await fireEvent(scrollHost(), 'contentSizeChange', 320, 1400);
  await tick();
  expect(scroll).not.toHaveBeenCalled();
  await press('저장');
  await tick();
  await act(async () => {
    await jest.advanceTimersByTimeAsync(32);
  });
  expect(scroll).toHaveBeenCalledWith({ animated: false });
  scroll.mockClear();
  await fireEvent(scrollHost(), 'contentSizeChange', 320, 1600);
  await tick();
  expect(scroll).toHaveBeenCalled();
});

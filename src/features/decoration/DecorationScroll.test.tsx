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

it.each(['remove-and-add', 'move', 'select'] as const)(
  'stops forcing the footer into view when editing resumes after an unsaved recovery: %s',
  async (edit) => {
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
    await press('별 스티커 붙이기');
    await press('저장');
    await tick();
    expect(screen.getByRole('button', { name: '저장 상태 확인' })).toBeTruthy();
    scroll.mockClear();
    await press('저장 상태 확인');
    await tick();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(32);
    });
    expect(screen.getByText(/아직 저장되지 않았어요/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '붙인 별 1 선택' })).toBeTruthy();
    expect(scroll).toHaveBeenCalledWith({ animated: false });
    scroll.mockClear();
    await fireEvent(scrollHost(), 'contentSizeChange', 320, 1600);
    await tick();
    expect(scroll).toHaveBeenCalledWith({ animated: false });

    scroll.mockClear();
    if (edit === 'remove-and-add') {
      await press('선택한 스티커 삭제');
      expect(
        screen.queryByRole('button', { name: '붙인 별 1 선택' }),
      ).toBeNull();
    } else if (edit === 'move') {
      await press('오른쪽으로 이동');
    } else {
      await press('붙인 별 1 선택');
    }
    await fireEvent(scrollHost(), 'contentSizeChange', 320, 1100);
    await fireEvent.scroll(scrollHost(), {
      nativeEvent: { contentOffset: { x: 0, y: 0 } },
    });
    await tick();
    expect(scroll).not.toHaveBeenCalled();
    await press('동그라미 스티커 붙이기');
    expect(screen.getByText('선택한 스티커 · 동그라미')).toBeTruthy();
    await fireEvent(scrollHost(), 'contentSizeChange', 320, 1600);
    await tick();
    expect(scroll).not.toHaveBeenCalled();

    await press('저장');
    await tick();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(32);
    });
    expect(screen.getByText('꾸미기를 저장했어요.')).toBeTruthy();
    expect(scroll).toHaveBeenCalledWith({ animated: false });
  },
);

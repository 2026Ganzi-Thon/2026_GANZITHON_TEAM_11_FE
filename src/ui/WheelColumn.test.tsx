import { afterEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ScrollView, AccessibilityInfo } from 'react-native';
import { WheelColumn } from './WheelColumn';
import { selectionFeedback } from './selectionFeedback';
jest.mock('./selectionFeedback', () => ({ selectionFeedback: jest.fn() }));
afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});
const values = Array.from({ length: 12 }, (_, i) => i + 1);
const props = {
  label: '월',
  values,
  value: 5,
  format: String,
  rowHeight: 34,
  disabled: false,
  onChange: jest.fn(),
};
const scroll = (y: number) => ({ nativeEvent: { contentOffset: { x: 0, y } } });
const adjust = (name: string) =>
  fireEvent(screen.getByRole('adjustable'), 'accessibilityAction', {
    nativeEvent: { actionName: name },
  });
it('tracks the native scroll continuously and accepts multiple crossed rows before release', async () => {
  await render(<WheelColumn {...props} />);
  const wheel = screen.getByTestId('wheel-월');
  await fireEvent(wheel, 'scrollBeginDrag', scroll(136));
  await fireEvent.scroll(wheel, scroll(150));
  expect(props.onChange).not.toHaveBeenCalled();
  await fireEvent.scroll(wheel, scroll(170));
  expect(props.onChange).toHaveBeenLastCalledWith(6);
  await fireEvent.scroll(wheel, scroll(204));
  expect(props.onChange).toHaveBeenLastCalledWith(7);
  expect(selectionFeedback).toHaveBeenCalledTimes(2);
  await fireEvent(wheel, 'momentumScrollEnd', scroll(204));
  expect(props.onChange).toHaveBeenCalledTimes(2);
});
it('keeps adjustment accessible, respects bounds and ignores delayed scrolling after disabled', async () => {
  await render(<WheelColumn {...props} value={1} />);
  await adjust('decrement');
  expect(props.onChange).not.toHaveBeenCalled();
  await adjust('increment');
  expect(props.onChange).toHaveBeenLastCalledWith(2);
  await screen.rerender(<WheelColumn {...props} value={2} disabled />);
  await fireEvent.scroll(screen.getByTestId('wheel-월'), scroll(238));
  await fireEvent(
    screen.getByTestId('wheel-월'),
    'momentumScrollEnd',
    scroll(238),
  );
  await adjust('increment');
  expect(props.onChange).toHaveBeenCalledTimes(1);
});
it('wraps time values and permits consecutive accessible adjustments without dropping them', async () => {
  await render(
    <WheelColumn {...props} values={[0, 15, 30, 45]} value={45} wrap />,
  );
  await adjust('increment');
  await adjust('increment');
  expect(props.onChange.mock.calls.map(([v]) => v)).toEqual([0, 15]);
});
it('ignores programmatic positioning but accepts a new drag after an external value/range change', async () => {
  await render(<WheelColumn {...props} />);
  await fireEvent.scroll(screen.getByTestId('wheel-월'), scroll(204));
  expect(props.onChange).not.toHaveBeenCalled();
  await fireEvent(
    screen.getByTestId('wheel-월'),
    'scrollBeginDrag',
    scroll(136),
  );
  await screen.rerender(
    <WheelColumn {...props} values={[1, 2, 3]} value={3} />,
  );
  await fireEvent.scroll(screen.getByTestId('wheel-월'), scroll(102));
  expect(props.onChange).not.toHaveBeenCalled();
  await fireEvent(
    screen.getByTestId('wheel-월'),
    'scrollBeginDrag',
    scroll(68),
  );
  await fireEvent.scroll(screen.getByTestId('wheel-월'), scroll(34));
  expect(props.onChange).toHaveBeenLastCalledWith(2);
});

it('recenters wrapped row taps instead of exposing the cyclic buffer edge', async () => {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(false);
  const move = jest.spyOn(ScrollView.prototype, 'scrollTo');
  await render(
    <WheelColumn {...props} label="오전·오후" values={[0, 1]} value={0} wrap />,
  );
  await fireEvent.press(screen.getAllByText('0')[0]);
  await fireEvent(
    screen.getByTestId('wheel-오전·오후'),
    'momentumScrollEnd',
    scroll(0),
  );
  expect(move).toHaveBeenLastCalledWith({ y: 100 * 34, animated: false });
  expect(props.onChange).not.toHaveBeenCalled();
  move.mockRestore();
});

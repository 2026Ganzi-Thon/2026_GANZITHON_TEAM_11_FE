import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Animated } from 'react-native';
import { WheelColumn } from './WheelColumn';
import { selectionFeedback } from './selectionFeedback';
jest.mock('./selectionFeedback', () => ({ selectionFeedback: jest.fn() }));
afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});
const change = (name: string) =>
  fireEvent(screen.getByLabelText('월'), 'accessibilityAction', {
    nativeEvent: { actionName: name },
  });
it('ticks only an accepted change, blocks repeated input until its spring settles and respects disabled/bounds', async () => {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(false);
  let finish: ((r: { finished: boolean }) => void) | undefined;
  const stop = jest.fn();
  jest.spyOn(Animated, 'spring').mockImplementation(() => ({
    start: (cb) => {
      finish = cb;
    },
    stop,
    reset: () => {},
  }));
  const onChange = jest.fn();
  const props = {
    label: '월',
    values: [1, 2],
    value: 1,
    format: String,
    rowHeight: 34,
    disabled: false,
    onChange,
  };
  await render(<WheelColumn {...props} />);
  await change('decrement');
  expect(selectionFeedback).not.toHaveBeenCalled();
  await change('increment');
  await change('increment');
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(selectionFeedback).toHaveBeenCalledTimes(1);
  await act(async () => finish?.({ finished: true }));
  await screen.rerender(<WheelColumn {...props} value={2} disabled />);
  await change('decrement');
  expect(onChange).toHaveBeenCalledTimes(1);
});
it('uses no spring with reduced motion and removes its live setting listener on unmount', async () => {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
  const remove = jest.fn();
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({ remove });
  const spring = jest.spyOn(Animated, 'spring'),
    onChange = jest.fn();
  const { unmount } = await render(
    <WheelColumn
      label="월"
      values={[1, 2]}
      value={1}
      format={String}
      rowHeight={34}
      disabled={false}
      onChange={onChange}
    />,
  );
  await change('increment');
  expect(onChange).toHaveBeenCalledWith(2);
  expect(spring).not.toHaveBeenCalled();
  await unmount();
  expect(remove).toHaveBeenCalledTimes(1);
});

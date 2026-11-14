import { afterEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Dimensions } from 'react-native';
import { DateWheel } from './DateWheel';
const originalWindow = Dimensions.get('window');
afterEach(() => Dimensions.set({ window: originalWindow }));
function touch(y: number, previousY = y, stamp = 1) {
  return {
    nativeEvent: { locationY: y },
    touchHistory: {
      numberActiveTouches: 1,
      indexOfSingleActiveTouch: 0,
      mostRecentTimeStamp: stamp,
      touchBank: [
        {
          touchActive: true,
          currentTimeStamp: stamp,
          currentPageX: 40,
          previousPageX: 40,
          currentPageY: y,
          previousPageY: previousY,
        },
      ],
    },
  };
}
it.each([
  [1, 34],
  [2, 56],
])(
  'selects a neighboring row at font scale %s',
  async (fontScale, rowHeight) => {
    Dimensions.set({ window: { ...originalWindow, fontScale } });
    const onChange = jest.fn();
    await render(
      <DateWheel
        value={{ year: 2004, month: 5, day: 14 }}
        todayYear={2026}
        disabled={false}
        onChange={onChange}
      />,
    );
    let row = screen.getByText('6월');
    while (!row.props.onMoveShouldSetResponderCapture && row.parent)
      row = row.parent;
    await fireEvent(row, 'responderGrant', touch(rowHeight * 3.5));
    await fireEvent(row, 'responderRelease', touch(rowHeight * 3.5));
    expect(onChange).toHaveBeenCalledWith('month', 6);
  },
);
it.each([
  [1, 34],
  [2, 56],
])(
  'drags one month at font scale %s without treating it as a tap',
  async (fontScale, rowHeight) => {
    Dimensions.set({ window: { ...originalWindow, fontScale } });
    const onChange = jest.fn();
    await render(
      <DateWheel
        value={{ year: 2004, month: 5, day: 14 }}
        todayYear={2026}
        disabled={false}
        onChange={onChange}
      />,
    );
    let row = screen.getByText('5월');
    while (!row.props.onMoveShouldSetResponderCapture && row.parent)
      row = row.parent;
    await fireEvent(row, 'responderGrant', touch(rowHeight * 2.5));
    await fireEvent(
      row,
      'responderMove',
      touch(rowHeight * 1.5, rowHeight * 2.5, 2),
    );
    await fireEvent(
      row,
      'responderRelease',
      touch(rowHeight * 1.5, rowHeight * 2.5, 2),
    );
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('month', 6);
  },
);

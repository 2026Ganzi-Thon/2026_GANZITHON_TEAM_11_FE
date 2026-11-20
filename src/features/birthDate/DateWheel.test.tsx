import { afterEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Dimensions } from 'react-native';
import { DateWheel } from './DateWheel';
const originalWindow = Dimensions.get('window');
afterEach(() => Dimensions.set({ window: originalWindow }));
const scroll = (y: number) => ({ nativeEvent: { contentOffset: { x: 0, y } } });
it.each([1, 2])(
  'scrolls continuously through months at font scale %s',
  async (fontScale) => {
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
    const wheel = screen.getByTestId('wheel-출생 월');
    const actualRowHeight = wheel.props.snapToInterval;
    await fireEvent(wheel, 'scrollBeginDrag', scroll(4 * actualRowHeight));
    await fireEvent.scroll(wheel, scroll(5 * actualRowHeight));
    expect(onChange).toHaveBeenLastCalledWith('month', 6);
    await fireEvent.scroll(wheel, scroll(6 * actualRowHeight));
    expect(onChange).toHaveBeenLastCalledWith('month', 7);
    await fireEvent(wheel, 'momentumScrollEnd', scroll(6 * actualRowHeight));
    expect(onChange).toHaveBeenCalledTimes(2);
  },
);
it('keeps years virtualized instead of mounting two thousand rows', async () => {
  await render(
    <DateWheel
      value={{ year: 2004, month: 5, day: 14 }}
      todayYear={2026}
      disabled={false}
      onChange={jest.fn()}
    />,
  );
  expect(screen.getByText('2004')).toBeTruthy();
  expect(screen.queryByText('1')).toBeNull();
});

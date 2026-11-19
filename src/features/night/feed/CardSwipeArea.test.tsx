import { expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { CardSwipeArea } from './CardSwipeArea';
const touch = (x: number, y: number, previousY = y, stamp = 1) => ({
  nativeEvent: {
    touches: [{ identifier: 0, pageX: x, pageY: y }],
    locationY: y,
  },
  touchHistory: {
    numberActiveTouches: 1,
    indexOfSingleActiveTouch: 0,
    mostRecentTimeStamp: stamp,
    touchBank: [
      {
        touchActive: true,
        currentTimeStamp: stamp,
        currentPageX: x,
        previousPageX: x,
        currentPageY: y,
        previousPageY: previousY,
      },
    ],
  },
});
it('captures a card swipe without losing the threshold distance on grant and keeps button taps usable', async () => {
  const move = jest.fn(),
    press = jest.fn();
  await render(
    <CardSwipeArea onMove={move} canMove={() => true} disabled={false}>
      <Pressable accessibilityRole="button" onPress={press}>
        <Text>반응</Text>
      </Pressable>
    </CardSwipeArea>,
  );
  const area = screen.getByTestId('feed-card-swipe');
  await fireEvent.press(screen.getByRole('button'));
  expect(press).toHaveBeenCalledTimes(1);
  expect(move).not.toHaveBeenCalled();
  await fireEvent(area, 'responderGrant', touch(50, 150));
  // Simulate a capture decision before PanResponder resets its deltas.
  expect(
    area.props.onMoveShouldSetResponderCapture(touch(50, 90, 150, 2)),
  ).toBe(true);
  await fireEvent(area, 'responderGrant', touch(50, 90));
  await act(async () => area.props.onResponderRelease(touch(50, 90, 90, 3)));
  expect(move).toHaveBeenCalledWith(1);
  expect(move).toHaveBeenCalledTimes(1);
});
it.each([
  [true, true],
  [false, false],
])(
  'does not page while nested/expanded content needs scrolling or the outer view can still scroll (disabled=%s)',
  async (disabled, canMove) => {
    const move = jest.fn();
    await render(
      <CardSwipeArea onMove={move} canMove={() => canMove} disabled={disabled}>
        <Text>긴 내용</Text>
      </CardSwipeArea>,
    );
    const area = screen.getByTestId('feed-card-swipe');
    await fireEvent(area, 'responderGrant', touch(50, 150));
    expect(
      area.props.onMoveShouldSetResponderCapture(touch(50, 20, 150, 2)),
    ).toBe(false);
    await fireEvent(area, 'responderRelease', touch(50, 20, 150, 2));
    expect(move).not.toHaveBeenCalled();
  },
);

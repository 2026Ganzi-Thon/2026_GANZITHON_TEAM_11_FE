import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Animated } from 'react-native';
import { SheepStage } from './SheepStage';

describe('dedicated feed gesture area', () => {
  it('owns the touch from the start so responder grant cannot discard the first part of a short swipe', async () => {
    await render(
      <SheepStage
        progress={new Animated.Value(0.5)}
        direction={1}
        onMove={() => {}}
      />,
    );
    const stage = screen.getByLabelText('양 이동 영역');
    const event = {
      nativeEvent: { touches: [{ identifier: 0, pageX: 10, pageY: 10 }] },
    };
    // PanResponder resets dx/dy on grant. Claiming after 40dp loses that distance.
    expect(stage.props.onStartShouldSetResponder(event)).toBe(true);
  });
  it('provides both directions through accessibility actions', async () => {
    const move = jest.fn();
    await render(
      <SheepStage
        progress={new Animated.Value(0.5)}
        direction={1}
        onMove={move}
      />,
    );
    const stage = screen.getByLabelText('양 이동 영역');
    await fireEvent(stage, 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });
    await fireEvent(stage, 'accessibilityAction', {
      nativeEvent: { actionName: 'decrement' },
    });
    expect(move.mock.calls).toEqual([[1], [-1]]);
  });
});

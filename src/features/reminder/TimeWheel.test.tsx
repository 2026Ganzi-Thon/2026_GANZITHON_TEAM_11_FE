import { expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { TimeWheel } from './TimeWheel';
it('shows AM/PM once and stops at either end while hours and minutes still wrap', async () => {
  const change = jest.fn();
  await render(
    <TimeWheel
      value={{ period: 1, hour: 12, minute: 45 }}
      disabled={false}
      onChange={change}
    />,
  );
  expect(screen.getAllByText('오전')).toHaveLength(1);
  expect(screen.getAllByText('오후')).toHaveLength(1);
  const adjust = (name: string, actionName = 'increment') =>
    fireEvent(screen.getByRole('adjustable', { name }), 'accessibilityAction', {
      nativeEvent: { actionName },
    });
  await adjust('알림 분');
  await adjust('알림 시');
  await adjust('알림 오전·오후');
  await adjust('알림 오전·오후', 'decrement');
  await adjust('알림 오전·오후', 'decrement');
  await adjust('알림 오전·오후');
  await adjust('알림 오전·오후');
  expect(change.mock.calls).toEqual([
    ['minute', 0],
    ['hour', 1],
    ['period', 0],
    ['period', 1],
  ]);
});
it('does not change a disabled wheel through accessibility actions', async () => {
  const change = jest.fn();
  await render(
    <TimeWheel
      value={{ period: 0, hour: 1, minute: 0 }}
      disabled
      onChange={change}
    />,
  );
  await fireEvent(
    screen.getByRole('adjustable', { name: '알림 분' }),
    'accessibilityAction',
    { nativeEvent: { actionName: 'increment' } },
  );
  expect(change).not.toHaveBeenCalled();
});

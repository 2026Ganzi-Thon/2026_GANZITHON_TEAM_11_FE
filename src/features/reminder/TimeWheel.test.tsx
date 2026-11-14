import { expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { TimeWheel } from './TimeWheel';
it('wraps minutes, hours and periods within valid choices without mixing their values', async () => {
  const change = jest.fn();
  await render(
    <TimeWheel
      value={{ period: 1, hour: 12, minute: 45 }}
      disabled={false}
      onChange={change}
    />,
  );
  for (const name of ['알림 분', '알림 시', '알림 오전·오후'])
    await fireEvent(
      screen.getByRole('adjustable', { name }),
      'accessibilityAction',
      { nativeEvent: { actionName: 'increment' } },
    );
  expect(change.mock.calls).toEqual([
    ['minute', 0],
    ['hour', 1],
    ['period', 0],
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

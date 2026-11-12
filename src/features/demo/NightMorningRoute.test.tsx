import { it, expect, jest, afterEach } from '@jest/globals';
import { renderRouter, screen, fireEvent } from 'expo-router/testing-library';
import { Text } from 'react-native';
import Preview from '../../app/dev/night-morning';
const dev = __DEV__;
afterEach(() => {
  Object.defineProperty(globalThis, '__DEV__', {
    value: dev,
    configurable: true,
  });
  jest.useRealTimers();
});
it('blocks release access to the demo and its synthetic time travel', async () => {
  Object.defineProperty(globalThis, '__DEV__', {
    value: false,
    configurable: true,
  });
  const view = await renderRouter(
    { index: () => <Text>시작</Text>, 'dev/night-morning': Preview },
    { initialUrl: '/dev/night-morning' },
  );
  expect(view.getPathname()).toBe('/');
  expect(
    screen.queryByRole('button', { name: '다음 아침으로 이동' }),
  ).toBeNull();
});
it('clears the draft when a demo is ended and restarted', async () => {
  Object.defineProperty(globalThis, '__DEV__', {
    value: true,
    configurable: true,
  });
  await renderRouter(
    { index: () => <Text>시작</Text>, 'dev/night-morning': Preview },
    { initialUrl: '/dev/night-morning' },
  );
  await fireEvent.press(
    screen.getByRole('button', { name: '밤→아침 시연 시작' }),
  );
  await fireEvent.press(screen.getByRole('radio', { name: '취업' }));
  await fireEvent.changeText(screen.getByLabelText('오늘의 고민'), '임시 고민');
  await fireEvent.press(screen.getByRole('button', { name: '뒤로' }));
  await fireEvent.press(
    screen.getByRole('button', { name: '밤→아침 시연 시작' }),
  );
  expect(screen.getByLabelText('오늘의 고민')).toHaveDisplayValue('');
});

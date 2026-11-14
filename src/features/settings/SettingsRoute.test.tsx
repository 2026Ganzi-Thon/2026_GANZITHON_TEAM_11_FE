import { expect, it } from '@jest/globals';
import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';
import Preview from '../../app/dev/settings';
it('blocks settings fixtures in release builds', async () => {
  const dev = __DEV__;
  Object.defineProperty(globalThis, '__DEV__', {
    value: false,
    configurable: true,
  });
  try {
    const view = await renderRouter(
      { index: () => <Text>시작</Text>, 'dev/settings': Preview },
      { initialUrl: '/dev/settings' },
    );
    expect(view.getPathname()).toBe('/');
  } finally {
    Object.defineProperty(globalThis, '__DEV__', {
      value: dev,
      configurable: true,
    });
  }
});

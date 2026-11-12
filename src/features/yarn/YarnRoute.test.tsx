import { it, expect } from '@jest/globals';
import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';
import Preview from '../../app/dev/yarn';
it('blocks release builds from yarn fixtures and the demo', async () => {
  const dev = __DEV__;
  Object.defineProperty(globalThis, '__DEV__', {
    value: false,
    configurable: true,
  });
  try {
    const view = await renderRouter(
      { index: () => <Text>시작</Text>, 'dev/yarn': Preview },
      { initialUrl: '/dev/yarn' },
    );
    expect(view.getPathname()).toBe('/');
  } finally {
    Object.defineProperty(globalThis, '__DEV__', {
      value: dev,
      configurable: true,
    });
  }
});

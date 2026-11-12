import { it, expect } from '@jest/globals';
import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';
import Preview from '../../app/dev/morning-reflection';
it('redirects release builds away from reflection fixtures', async () => {
  const previous = __DEV__;
  Object.defineProperty(globalThis, '__DEV__', {
    value: false,
    configurable: true,
  });
  try {
    const result = await renderRouter(
      { index: () => <Text>시작</Text>, 'dev/morning-reflection': Preview },
      { initialUrl: '/dev/morning-reflection' },
    );
    expect(result.getPathname()).toBe('/');
  } finally {
    Object.defineProperty(globalThis, '__DEV__', {
      value: previous,
      configurable: true,
    });
  }
});

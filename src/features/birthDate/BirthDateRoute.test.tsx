import { expect, it } from '@jest/globals';
import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';
import Preview from '../../app/dev/birth-date';
import FlowPreview from '../../app/dev/birth-date-flow';
it.each([
  ['dev/birth-date', Preview],
  ['dev/birth-date-flow', FlowPreview],
] as const)('blocks %s fixtures in release builds', async (path, Component) => {
  const dev = __DEV__;
  Object.defineProperty(globalThis, '__DEV__', {
    value: false,
    configurable: true,
  });
  try {
    const view = await renderRouter(
      { index: () => <Text>시작</Text>, [path]: Component },
      { initialUrl: `/${path}` },
    );
    expect(view.getPathname()).toBe('/');
  } finally {
    Object.defineProperty(globalThis, '__DEV__', {
      value: dev,
      configurable: true,
    });
  }
});

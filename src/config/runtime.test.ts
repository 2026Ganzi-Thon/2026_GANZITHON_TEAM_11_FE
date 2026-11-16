import { afterEach, expect, it, jest } from '@jest/globals';
import Constants from 'expo-constants';
import { canUseMock, isPreviewBuild } from './runtime';
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { extra: {}, android: { package: 'com.ganzithon.yangsebam' } },
  },
}));
const original = __DEV__;
afterEach(() => {
  Object.defineProperty(globalThis, '__DEV__', {
    value: original,
    configurable: true,
  });
  Constants.expoConfig!.extra = {};
  Constants.expoConfig!.android!.package = 'com.ganzithon.yangsebam';
});
it('permits a development session without opting a production release into mock data', () => {
  Object.defineProperty(globalThis, '__DEV__', {
    value: true,
    configurable: true,
  });
  expect(canUseMock()).toBe(true);
  expect(isPreviewBuild()).toBe(false);
  Object.defineProperty(globalThis, '__DEV__', {
    value: false,
    configurable: true,
  });
  expect(canUseMock()).toBe(false);
});
it('permits a standalone preview only with the explicit variant and separate package', () => {
  Object.defineProperty(globalThis, '__DEV__', {
    value: false,
    configurable: true,
  });
  Constants.expoConfig!.extra = { appVariant: 'preview' };
  expect(canUseMock()).toBe(false);
  Constants.expoConfig!.android!.package = 'com.ganzithon.yangsebam.preview';
  expect(canUseMock()).toBe(true);
  expect(isPreviewBuild()).toBe(true);
  Constants.expoConfig!.extra = { appVariant: 'production' };
  expect(canUseMock()).toBe(false);
});

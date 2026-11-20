import { afterEach, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import NativePreview from '../../app/dev/android-reminder';
import { AndroidReminderRuntime } from '../../notifications/AndroidReminderRuntime';
import {
  getNativeReminderSession,
  startNativeReminderRuntime,
} from '../../notifications/nativeRuntime';
jest.mock('../../notifications/nativeRuntime', () => ({
  getNativeReminderSession: jest.fn(),
  startNativeReminderRuntime: jest.fn(),
}));
jest.mock('expo-router', () => ({
  usePathname: () => '/',
  Redirect: ({ href }: { href: string }) => {
    const { Text } =
      jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>{`redirect:${href}`}</Text>;
  },
}));
const original = __DEV__;
afterEach(() => {
  Object.defineProperty(globalThis, '__DEV__', {
    value: original,
    configurable: true,
  });
});
it('does not initialize native reminder work from the route or root in a release build', async () => {
  Object.defineProperty(globalThis, '__DEV__', {
    value: false,
    configurable: true,
  });
  await render(
    <>
      <AndroidReminderRuntime />
      <NativePreview />
    </>,
  );
  expect(screen.getByText('redirect:/')).toBeTruthy();
  expect(getNativeReminderSession).not.toHaveBeenCalled();
  expect(startNativeReminderRuntime).not.toHaveBeenCalled();
});

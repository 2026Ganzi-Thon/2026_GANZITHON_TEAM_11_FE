import { afterEach, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import ReminderPreview from '../../app/dev/reminder';
jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text } =
      jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>{`redirect:${href}`}</Text>;
  },
  router: { replace: jest.fn(), back: jest.fn(), canGoBack: () => false },
}));
const original = __DEV__;
afterEach(() => {
  Object.defineProperty(globalThis, '__DEV__', {
    value: original,
    configurable: true,
  });
});
it('guards the reminder demo in a release build', async () => {
  Object.defineProperty(globalThis, '__DEV__', {
    value: false,
    configurable: true,
  });
  await render(<ReminderPreview />);
  expect(screen.getByText('redirect:/')).toBeTruthy();
  expect(screen.queryByRole('button', { name: '알림 설정·저장' })).toBeNull();
});

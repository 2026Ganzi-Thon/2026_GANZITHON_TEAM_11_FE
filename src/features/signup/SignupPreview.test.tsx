import { afterEach, expect, it } from '@jest/globals';
import { Text } from 'react-native';
import { renderRouter, screen, fireEvent } from 'expo-router/testing-library';
import SignupPreview from '../../app/dev/signup';
const dev = __DEV__;
afterEach(() => {
  Object.defineProperty(globalThis, '__DEV__', {
    value: dev,
    configurable: true,
  });
});
it('blocks the signup preview path in production', async () => {
  Object.defineProperty(globalThis, '__DEV__', {
    value: false,
    configurable: true,
  });
  const r = await renderRouter(
    { index: () => <Text>시작</Text>, 'dev/signup': SignupPreview },
    { initialUrl: '/dev/signup' },
  );
  expect(r.getPathname()).toBe('/');
});
it('starts only after an explicit mock choice and opens the existing login screen', async () => {
  await renderRouter(
    { index: () => <Text>시작</Text>, 'dev/signup': SignupPreview },
    { initialUrl: '/dev/signup' },
  );
  expect(
    screen.queryByRole('button', { name: '이메일로 회원가입' }),
  ).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '가입 흐름 확인' }));
  await fireEvent.press(
    screen.getByRole('button', { name: '이메일로 로그인' }),
  );
  expect(screen.getByLabelText('비밀번호')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: '뒤로' }));
  expect(
    screen.getByRole('button', { name: '이메일로 회원가입' }),
  ).toBeTruthy();
});

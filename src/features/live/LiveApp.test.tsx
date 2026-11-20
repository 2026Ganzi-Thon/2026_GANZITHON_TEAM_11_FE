import { expect, it } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { LiveApp } from './LiveApp';
import type { Auth, Bootstrap } from '../../api/contracts';
import { createApiClient } from '../../api/client';
import { createApiSession } from '../../api/session';
import { createLiveResources } from '../../api/resources';
import { createSignupOnboarding } from '../signup/onboarding';
import { createDeviceReminder } from '../../notifications/service';
import { createReminderConnection } from '../../notifications/connection';
import { fakeDevice } from '../../notifications/__tests__/fakeDevice';

const token: Auth = {
  access_token: 'access',
  refresh_token: 'refresh',
  token_type: 'Bearer',
  expires_in: 3600,
};
const profile = {
  id: 'real-account',
  email: 'real@example.com',
  birth_date: '2000-01-01',
  birth_date_edits_remaining: 1,
  stats: { night_count: 0, counted_sheep_total: 0, worry_record_count: 0 },
};
function fixture(
  initial: Auth | null = null,
  next: Bootstrap['next_screen'] = 'DAY_INTRO',
) {
  let saved = initial,
    nextScreen = next;
  const paths: string[] = [];
  const api = createApiSession(
    createApiClient({
      baseUrl: 'https://server.example.com/api/v1',
      fetch: async (url, init) => {
        const path = new URL(url).pathname.replace('/api/v1', '');
        paths.push(path);
        if (path === '/auth/login') return new Response(JSON.stringify(token));
        if (path === '/bootstrap')
          return new Response(
            JSON.stringify({
              server_time: '2026-11-20T05:30:00.123456Z',
              timezone: 'Asia/Seoul',
              phase: 'day',
              night_date: '2026-11-19',
              next_screen: nextScreen,
              user: profile,
              night_id: null,
              active_session_id: null,
              last_session: null,
              support: null,
              reminder: { enabled: false, local_time: null },
              required_consents: { terms_version: 'v1', privacy_version: 'v1' },
            }),
          );
        if (path === '/me/day-intro') {
          nextScreen = 'HOME';
          return new Response(null, { status: 204 });
        }
        if (path === '/me/birth-date') {
          nextScreen = 'DAY_INTRO';
          return new Response(
            JSON.stringify({
              birth_date: '2004-05-14',
              edits_remaining: 1,
              zodiac: 'taurus',
            }),
          );
        }
        if (path === '/me')
          return new Response(
            JSON.stringify({
              user: profile,
              reminder: { enabled: false, local_time: null },
            }),
          );
        return new Response(
          JSON.stringify({ error: { code: 'UNAVAILABLE' } }),
          { status: 503 },
        );
      },
    }),
    {
      read: async () => saved,
      write: async (value) => {
        saved = value;
      },
    },
  );
  const context = {
    api,
    createAccount() {
      const resources = createLiveResources(api);
      const service = createDeviceReminder(fakeDevice().port);
      const reminder = createReminderConnection(resources.reminder, service);
      resources.settings.reminder = reminder;
      const onboarding = createSignupOnboarding(
        reminder,
        () => resources.home,
        resources.acknowledgeIntro,
      );
      return {
        resources,
        reminder,
        onboarding,
        silence: async () => {
          await service.sync({ enabled: false, local_time: null });
        },
      };
    },
  };
  return { context, paths, saved: () => saved };
}
const flush = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
const press = (label: string) =>
  fireEvent.press(screen.getByRole('button', { name: label }));
it('logs into the server, saves the intro once and shows the same account in settings', async () => {
  const f = fixture();
  await render(
    <SafeAreaInsetsContext.Provider
      value={{ top: 24, bottom: 24, left: 0, right: 0 }}
    >
      <LiveApp context={f.context} onExit={() => {}} />
    </SafeAreaInsetsContext.Provider>,
  );
  await flush();
  await press('이메일로 로그인');
  await fireEvent.changeText(
    screen.getByLabelText('이메일 주소'),
    'real@example.com',
  );
  await fireEvent.changeText(screen.getByLabelText('비밀번호'), 'password-123');
  await press('로그인');
  await flush();
  await flush();
  expect(screen.getByRole('button', { name: '밤에 만나요' })).toBeTruthy();
  await press('밤에 만나요');
  await flush();
  await flush();
  expect(screen.getByText('아직 센 양이 없어요')).toBeTruthy();
  expect(f.saved()).toEqual(token);
  expect(f.paths.filter((p) => p === '/me/day-intro')).toHaveLength(1);
  await press('설정 열기');
  await flush();
  expect(screen.getAllByText('real@example.com')).toHaveLength(2);
});
it('restores incomplete onboarding from bootstrap without creating another account', async () => {
  const f = fixture(token, 'ONBOARDING_BIRTH_DATE');
  await render(
    <SafeAreaInsetsContext.Provider
      value={{ top: 24, bottom: 24, left: 0, right: 0 }}
    >
      <LiveApp context={f.context} onExit={() => {}} />
    </SafeAreaInsetsContext.Provider>,
  );
  await flush();
  expect(screen.getByText('생일을 알려 주세요')).toBeTruthy();
  await press('다음');
  await flush();
  await flush();
  expect(screen.getByText('밤이 오면\n알려 드려도 될까요?')).toBeTruthy();
  expect(f.paths).toContain('/me/birth-date');
  expect(f.paths).not.toContain('/auth/register');
});

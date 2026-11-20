import { createApiClient } from '../../api/client';
import { getApiBaseUrl } from '../../api/config';
import { createApiSession } from '../../api/session';
import { tokenStore } from '../../api/tokenStore';
import { createLiveResources } from '../../api/resources';
import { createReminderConnection } from '../../notifications/connection';
import { createDeviceReminder } from '../../notifications/service';
import { createExpoAndroidPort } from '../../notifications/expoAndroid';
import { createSignupOnboarding } from '../signup/onboarding';

export function createLiveContext() {
  const api = createApiSession(
    createApiClient({
      baseUrl: getApiBaseUrl(
        process.env.EXPO_PUBLIC_API_BASE_URL || 'https://54.252.207.11/api/v1',
      ),
    }),
    tokenStore,
  );
  return {
    api,
    createAccount() {
      const resources = createLiveResources(api);
      const service = createDeviceReminder(createExpoAndroidPort());
      const reminder = createReminderConnection(resources.reminder, service);
      resources.settings.reminder = reminder;
      const silence = async () => {
        // Local cleanup must not change the account's desired reminder preference.
        const state = await service.sync({ enabled: false, local_time: null });
        if (state.state !== 'off') throw new Error('Reminder cleanup failed');
      };
      resources.settings.logout = {
        logout: async (signal) => {
          await silence();
          await api.logout(signal);
        },
      };
      resources.settings.withdrawal = {
        withdraw: async (signal) => {
          await silence();
          await api.request('/me', { method: 'DELETE', signal });
          await api.clear();
        },
      };
      const onboarding = createSignupOnboarding(
        reminder,
        () => resources.home,
        resources.acknowledgeIntro,
      );
      return { resources, reminder, onboarding, silence };
    },
  };
}
export type LiveContext = ReturnType<typeof createLiveContext>;

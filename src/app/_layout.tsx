import { Stack } from 'expo-router';
import { AndroidReminderRuntime } from '../notifications/AndroidReminderRuntime';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <AndroidReminderRuntime />
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#242460' },
        }}
      />
    </>
  );
}

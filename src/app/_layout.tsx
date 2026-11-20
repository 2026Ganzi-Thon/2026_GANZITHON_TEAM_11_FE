import { useFonts } from 'expo-font';
import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { AndroidReminderRuntime } from '../notifications/AndroidReminderRuntime';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts([
    {
      fontFamily: 'PFStardust',
      fontDefinitions: [
        { path: require('../../.expo/app-fonts/PFStardust.ttf'), weight: 400 },
        {
          path: require('../../.expo/app-fonts/PFStardustBold.ttf'),
          weight: 700,
        },
      ],
    },
    {
      fontFamily: 'OwnglyphPDH',
      fontDefinitions: [
        { path: require('../../.expo/app-fonts/OwnglyphPDH.ttf'), weight: 400 },
      ],
    },
  ]);
  if (!fontsLoaded && !fontError)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#242460',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color="#EEF0FF" />
      </View>
    );
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

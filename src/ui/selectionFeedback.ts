import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
export function selectionFeedback() {
  void Promise.resolve()
    .then(() =>
      Platform.OS === 'android'
        ? Haptics.performAndroidHapticsAsync(
            Haptics.AndroidHaptics.Segment_Frequent_Tick,
          )
        : Haptics.selectionAsync(),
    )
    .catch(() => {});
}

import { Linking, Platform } from 'react-native';
import { supportTarget, type SupportResource } from './model';
export async function openSupportResource(
  resource: SupportResource,
): Promise<void> {
  const target = supportTarget(resource, Platform.OS);
  if (!target) throw new Error('unavailable');
  try {
    await Linking.openURL(target);
  } catch {
    throw new Error('open-failed');
  }
}

import Constants from 'expo-constants';

/** A preview is a separate install, never an implicit production fallback. */
export function isPreviewBuild(): boolean {
  return (
    Constants.expoConfig?.extra?.appVariant === 'preview' &&
    Constants.expoConfig?.android?.package === 'com.ganzithon.yangsebam.preview'
  );
}
export function canUseMock(): boolean {
  return __DEV__ || isPreviewBuild();
}

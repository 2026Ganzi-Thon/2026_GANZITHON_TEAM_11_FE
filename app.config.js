const base = require('./app.json').expo;

module.exports = ({ config }) => {
  const variant = process.env.APP_VARIANT ?? 'production';
  if (!['preview', 'production'].includes(variant))
    throw new Error('APP_VARIANT must be preview or production');
  const preview = variant === 'preview';
  const projectId = base.extra?.eas?.projectId;
  if (
    preview &&
    !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(projectId ?? '')
  )
    throw new Error('Preview OTA requires a valid EAS project ID in app.json.');
  return {
    ...config,
    ...base,
    name: preview ? '양 세는 밤 · 체험판' : base.name,
    scheme: preview ? 'yangsebam-preview' : base.scheme,
    version: preview ? `${base.version}-preview.5` : base.version,
    android: {
      ...base.android,
      package: preview
        ? 'com.ganzithon.yangsebam.preview'
        : base.android.package,
      versionCode: preview ? 5 : 1,
    },
    runtimeVersion: preview ? { policy: 'fingerprint' } : undefined,
    updates: preview
      ? {
          enabled: true,
          url: `https://u.expo.dev/${projectId}`,
          requestHeaders: { 'expo-channel-name': 'preview' },
          checkAutomatically: 'ON_LOAD',
          fallbackToCacheTimeout: 0,
          useEmbeddedUpdate: true,
        }
      : { enabled: false },
    extra: {
      ...base.extra,
      ...config.extra,
      ...(projectId
        ? { eas: { ...config.extra?.eas, ...base.extra.eas } }
        : {}),
      appVariant: variant,
    },
  };
};

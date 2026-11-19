const base = require('./app.json').expo;

module.exports = ({ config }) => {
  const variant = process.env.APP_VARIANT ?? 'production';
  if (!['preview', 'production'].includes(variant))
    throw new Error('APP_VARIANT must be preview or production');
  const preview = variant === 'preview';
  return {
    ...config,
    ...base,
    name: preview ? '양 세는 밤 · 체험판' : base.name,
    scheme: preview ? 'yangsebam-preview' : base.scheme,
    version: preview ? `${base.version}-preview.3` : base.version,
    android: {
      ...base.android,
      package: preview
        ? 'com.ganzithon.yangsebam.preview'
        : base.android.package,
      versionCode: preview ? 3 : 1,
    },
    extra: { ...config.extra, appVariant: variant },
  };
};

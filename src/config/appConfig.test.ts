import { afterEach, expect, it, jest } from '@jest/globals';
import type { ExpoConfig } from 'expo/config';
import configure from '../../app.config';
import app from '../../app.json';
jest.mock('../../app.json', () => {
  const actual = jest.requireActual<{ expo: ExpoConfig }>('../../app.json');
  return {
    expo: {
      ...actual.expo,
      extra: { eas: { projectId: '12345678-1234-4234-8234-123456789abc' } },
    },
  };
});
const base = app.expo as ExpoConfig;
const originalExtra = base.extra,
  originalVariant = process.env.APP_VARIANT;
afterEach(() => {
  base.extra = originalExtra;
  if (originalVariant === undefined) delete process.env.APP_VARIANT;
  else process.env.APP_VARIANT = originalVariant;
});
it('routes only the standalone mock preview to its compatible update channel while keeping offline startup', () => {
  process.env.APP_VARIANT = 'preview';
  const c = configure({
    config: {
      runtimeVersion: 'wrong-runtime',
      updates: { enabled: true, url: 'https://example.com/wrong-channel' },
      extra: {
        existing: true,
        appVariant: 'production',
        eas: { projectId: 'wrong-id' },
      },
    },
  });
  expect(c.android?.package).toBe('com.ganzithon.yangsebam.preview');
  expect(c.extra).toMatchObject({
    existing: true,
    appVariant: 'preview',
    eas: { projectId: '12345678-1234-4234-8234-123456789abc' },
  });
  expect(c.runtimeVersion).toEqual({ policy: 'fingerprint' });
  expect(c.updates).toMatchObject({
    enabled: true,
    url: 'https://u.expo.dev/12345678-1234-4234-8234-123456789abc',
    requestHeaders: { 'expo-channel-name': 'preview' },
    checkAutomatically: 'ON_LOAD',
    fallbackToCacheTimeout: 0,
    useEmbeddedUpdate: true,
  });
  expect(c.scheme).toBe('yangsebam-preview');
  expect(c.name).toContain('체험판');
  expect(c.android?.versionCode).toBe(6);
  expect(c.version).toBe('0.1.0-preview.6');
});
it.each([undefined, 'production'])(
  'keeps production updates and mock access disabled despite inherited preview settings (%s)',
  (variant) => {
    if (variant) process.env.APP_VARIANT = variant;
    else delete process.env.APP_VARIANT;
    const c = configure({
      config: {
        runtimeVersion: 'unsafe-inherited-runtime',
        updates: { enabled: true, url: 'https://example.com/updates' },
        extra: { appVariant: 'preview', test: 'preserved' },
      },
    });
    expect(c.updates).toEqual({ enabled: false });
    expect(c.runtimeVersion).toBeUndefined();
    expect(c.android?.package).toBe('com.ganzithon.yangsebam');
    expect(c.extra).toMatchObject({
      appVariant: 'production',
      test: 'preserved',
    });
    expect(c.scheme).toBe('yangsebam');
    expect(c.version).toBe('0.1.0');
    expect(c.android?.versionCode).toBe(1);
  },
);
it.each([undefined, 'not-a-project-id'])(
  'refuses an OTA preview with no usable EAS project binding (%s)',
  (projectId) => {
    process.env.APP_VARIANT = 'preview';
    base.extra = { eas: { projectId } };
    expect(() => configure({ config: {} })).toThrow(/EAS project/);
  },
);
it('rejects an unrecognized variant instead of selecting a publish environment implicitly', () => {
  process.env.APP_VARIANT = 'preveiw';
  expect(() => configure({ config: {} })).toThrow(
    'APP_VARIANT must be preview or production',
  );
});

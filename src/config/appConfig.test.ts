import { afterEach, expect, it } from '@jest/globals';
import configure from '../../app.config';
const original = process.env.APP_VARIANT;
afterEach(() => {
  if (original === undefined) delete process.env.APP_VARIANT;
  else process.env.APP_VARIANT = original;
});
it('keeps the production identifier and mock opt-in closed by default', () => {
  delete process.env.APP_VARIANT;
  const config = configure({ config: { extra: { test: 'preserved' } } });
  expect(config.android.package).toBe('com.ganzithon.yangsebam');
  expect(config.scheme).toBe('yangsebam');
  expect(config.android.versionCode).toBe(1);
  expect(config.extra).toEqual({ test: 'preserved', appVariant: 'production' });
});
it('separates preview identity and carries a visible build version', () => {
  process.env.APP_VARIANT = 'preview';
  const config = configure({ config: {} });
  expect(config.android.package).toBe('com.ganzithon.yangsebam.preview');
  expect(config.scheme).toBe('yangsebam-preview');
  expect(config.name).toContain('체험판');
  expect(config.extra.appVariant).toBe('preview');
  expect(config.android.versionCode).toBe(3);
  expect(config.version).toBe('0.1.0-preview.3');
});
it('rejects a misspelled variant instead of silently distributing the wrong app', () => {
  process.env.APP_VARIANT = 'preveiw';
  expect(() => configure({ config: {} })).toThrow(/APP_VARIANT/);
});

import { describe, expect, it } from '@jest/globals';
import { getApiBaseUrl } from './config';
import { createApiClient } from './client';

describe('API configuration', () => {
  it.each([
    '',
    '  ',
    'not-a-url',
    'file:///private/data',
    'https://user:password@example.com/api/v1',
    'https://example.com/api/v1?token=private',
    'https://example.com/api/v1#fragment',
  ])('rejects an unusable or credential-bearing base URL: %s', (value) => {
    expect(() => getApiBaseUrl(value)).toThrow('Invalid API configuration');
  });

  it('accepts local development HTTP and normalizes trailing slashes', () => {
    expect(getApiBaseUrl(' http://127.0.0.1:3000/api/v1/ ')).toBe(
      'http://127.0.0.1:3000/api/v1',
    );
  });

  it.each([0, -1, NaN, Infinity])(
    'rejects a timeout that cannot bound a request: %s',
    (timeoutMs) => {
      expect(() =>
        createApiClient({ baseUrl: 'https://example.com/api/v1', timeoutMs }),
      ).toThrow('Invalid API configuration');
    },
  );
});

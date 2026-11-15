import { expect, it } from '@jest/globals';
import { ApiError, httpError } from '../../api/errors';
import { readSupport, supportTarget } from './model';
const payload = {
  message: '잠시 쉬어 가도 괜찮아요.',
  resources: [{ label: '연락처 열기', action: 'open_contacts', target: null }],
};
it('preserves the support payload from an HTTP error through ApiError to the screen projection', () => {
  const error = httpError({ status: 422, headers: new Headers() } as Response, {
    error: { code: 'SUPPORT_RECOMMENDED', support: payload },
  });
  expect(readSupport(error.support)).toEqual(payload);
  expect(
    readSupport(new ApiError('http', { support: payload }).support),
  ).toEqual(payload);
});
it.each([
  {
    ...payload,
    resources: [{ label: '실행', action: { toString: 'call' }, target: null }],
  },
  undefined,
  null,
  {},
  { ...payload, message: '' },
  { ...payload, resources: null },
  {
    ...payload,
    resources: [{ label: '실행', action: 'unknown', target: null }],
  },
])(
  'does not present malformed support as a normal resource list (%p)',
  (value) => {
    expect(readSupport(value)).toBeNull();
  },
);
it('keeps an empty resource list and copies valid resources without mutating the payload', () => {
  expect(readSupport({ ...payload, resources: [] })).toEqual({
    ...payload,
    resources: [],
  });
  const result = readSupport(payload)!;
  result.resources[0].label = '수정';
  expect(payload.resources[0].label).toBe('연락처 열기');
});
it.each([
  [
    { label: '전화', action: 'call', target: '01000000000' },
    'android',
    'tel:01000000000',
  ],
  [
    {
      label: '전화',
      action: 'call',
      target: 'tel:+82109',
    },
    'android',
    'tel:+82109',
  ],
  [
    { label: '연락처', action: 'open_contacts', target: null },
    'android',
    'content://com.android.contacts/contacts',
  ],
  [
    { label: '웹', action: 'open_url', target: 'https://example.com/help' },
    'android',
    'https://example.com/help',
  ],
] as const)(
  'maps only the declared action to its allowed device target',
  (resource, platform, target) => {
    expect(supportTarget(resource, platform)).toBe(target);
  },
);
it.each([
  { label: '웹', action: 'open_url', target: 'javascript:alert(1)' },
  { label: '웹', action: 'open_url', target: 'intent://anything' },
  { label: '웹', action: 'open_url', target: 'https://user:pass@example.com' },
  { label: '웹', action: 'open_url', target: 'http://example.com' },
  { label: '웹', action: 'open_url', target: null },
  { label: '전화', action: 'call', target: '01000000000;123' },
  { label: '전화', action: 'call', target: 'tel:*123#' },
  { label: '연락처', action: 'open_contacts', target: 'https://example.com' },
] as const)('rejects an unavailable or unintended target (%p)', (resource) => {
  expect(supportTarget(resource, 'android')).toBeNull();
});
it('does not invent a contacts scheme on an unsupported platform', () => {
  expect(
    supportTarget(
      { label: '연락처', action: 'open_contacts', target: null },
      'ios',
    ),
  ).toBeNull();
});

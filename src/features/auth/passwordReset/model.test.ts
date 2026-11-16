import { expect, it } from '@jest/globals';
import {
  assertResetAccepted,
  emailIssue,
  normalizeEmail,
  retryDeadline,
} from './model';
it('normalizes only email and validates the normalized 1–254 character address', () => {
  expect(normalizeEmail(' User@Example.COM ')).toBe('user@example.com');
  expect(emailIssue(' User@Example.COM ')).toBeUndefined();
  expect(emailIssue('')).toBeTruthy();
  expect(emailIssue('invalid')).toBeTruthy();
  expect(emailIssue('a b@example.com')).toBeTruthy();
  expect(emailIssue(`${'a'.repeat(243)}@example.com`)).toBeTruthy();
});
it.each([null, {}, { accepted: false }, { accepted: 'true' }])(
  'rejects an unconfirmed receipt %j',
  (value) => {
    expect(() => assertResetAccepted(value)).toThrow();
  },
);
it('accepts only a confirmed receipt and ignores unrendered account details', () => {
  expect(() =>
    assertResetAccepted({ accepted: true, private_detail: 'unused' }),
  ).not.toThrow();
});
it('uses Retry-After seconds and HTTP dates, including already-expired values', () => {
  const now = Date.parse('2026-11-17T00:00:00Z');
  expect(retryDeadline('3', now)).toBe(now + 3000);
  expect(retryDeadline(new Date(now + 5000).toUTCString(), now)).toBe(
    now + 5000,
  );
  expect(retryDeadline('0', now)).toBe(now);
  expect(retryDeadline(new Date(now - 5000).toUTCString(), now)).toBe(now);
});
it.each([
  undefined,
  '',
  '-1',
  '1.5',
  'Infinity',
  'not a date',
  '2099 GMT',
  'Tue, 31 Nov 2026 00:00:00 GMT',
])('does not invent a cooldown for invalid Retry-After %s', (value) => {
  expect(retryDeadline(value, Date.now())).toBeNull();
});

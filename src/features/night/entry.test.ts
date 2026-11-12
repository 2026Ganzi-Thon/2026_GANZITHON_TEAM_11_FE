import { describe, expect, it } from '@jest/globals';
import { changeSheepCount, validateWorry } from './entry';

describe('night entry constraints', () => {
  it('requires a category and nonblank text except for no worry', () => {
    expect(validateWorry(null, 'hello', 200)).toBe('고민 종류를 골라 주세요.');
    expect(validateWorry('career', ' \n ', 200)).toBe(
      '고민을 한두 줄 적어 주세요.',
    );
    expect(validateWorry('none', '', 200)).toBeNull();
    expect(validateWorry('study', '내일 시험이에요', 200)).toBeNull();
  });
  it('enforces the supplied limit, including pasted text', () => {
    expect(validateWorry('study', '가'.repeat(200), 200)).toBeNull();
    expect(validateWorry('study', '가'.repeat(201), 200)).toBe(
      '200자 이내로 적어 주세요.',
    );
    expect(validateWorry('study', '가'.repeat(201), 500)).toBeNull();
    expect(validateWorry('none', '가'.repeat(201), 200)).toBeNull();
  });
  it('keeps all count adjustments within 3–30', () => {
    expect(changeSheepCount(3, -1)).toBe(3);
    expect(changeSheepCount(30, 1)).toBe(30);
    expect(changeSheepCount(15, -1)).toBe(14);
    expect(changeSheepCount(15, 1)).toBe(16);
  });
});

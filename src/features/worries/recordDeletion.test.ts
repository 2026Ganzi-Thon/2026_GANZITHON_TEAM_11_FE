import { afterEach, expect, it, jest } from '@jest/globals';
import { createWorryDeletions, maskDeletedWorry } from './deletions';
import { createMockWorryRecords } from '../../mocks/worryRecords';
afterEach(() => {
  jest.restoreAllMocks();
});
it('upgrades an original-only deletion to full-record deletion once without changing other records', async () => {
  const source = createWorryDeletions(
    { remove: async () => {} },
    { remove: async () => {}, check: async () => true },
  );
  const changed = jest.fn();
  source.subscribe(changed);
  const signal = new AbortController().signal;
  await source.remove('a', signal);
  expect(source.records!.isDeleted('a')).toBe(false);
  await source.records!.remove('a', signal);
  await source.records!.remove('a', signal);
  expect(changed).toHaveBeenCalledTimes(2);
  expect(source.isDeleted('a')).toBe(true);
  expect(source.isDeleted('b')).toBe(false);
  expect(
    maskDeletedWorry(
      { worry_text: 'old', reflection: { answer: 'same' } },
      'a',
      source,
    ),
  ).toEqual({ worry_text: null, reflection: null });
});
it('does not publish an uncertain removal until lookup confirms it and rejects malformed lookup results', async () => {
  const source = createWorryDeletions(
    { remove: async () => {} },
    {
      remove: async () => {
        throw Error('lost');
      },
      check: jest
        .fn<() => Promise<boolean>>()
        .mockResolvedValueOnce('yes' as never)
        .mockResolvedValue(true),
    },
  );
  const signal = new AbortController().signal;
  await expect(source.records!.remove('a', signal)).rejects.toThrow();
  expect(source.records!.isDeleted('a')).toBe(false);
  await expect(source.records!.check('a', signal)).rejects.toThrow();
  expect(source.isDeleted('a')).toBe(false);
  expect(await source.records!.check('a', signal)).toBe(true);
  expect(source.records!.isDeleted('a')).toBe(true);
});
it('keeps original-only replies but prevents a late save from restoring a fully deleted record', () => {
  const source = createMockWorryRecords([
    {
      id: 'a',
      night_date: '2026-11-10',
      category_id: 'career',
      worry_text: 'worry',
      worry_saved_at: null,
      entrusted: true,
      reflection: { answer: 'same', message: 'reply' },
    },
  ]);
  source.erase('a');
  expect(source.get('a')!.reflection?.message).toBe('reply');
  source.eraseRecord('a');
  expect(source.get('a')!.reflection).toBeNull();
  expect(() =>
    source.saveReflection('a', { answer: 'bigger', message: 'late' }),
  ).toThrow();
  expect(source.get('a')!.reflection).toBeNull();
});

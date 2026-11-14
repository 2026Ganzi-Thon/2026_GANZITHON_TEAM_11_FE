import { afterEach, expect, it, jest } from '@jest/globals';
import { createMockBirthDate } from '../../mocks/birthDate';
const signal = () => new AbortController().signal;
afterEach(() => {
  jest.useRealTimers();
});
async function settle<T>(request: Promise<T>) {
  await jest.runAllTimersAsync();
  return request;
}
it('keeps quota for an identical date and consumes only one change across identical retries', async () => {
  jest.useFakeTimers();
  const source = createMockBirthDate();
  expect(await settle(source.save('2004-05-14', signal()))).toMatchObject({
    edits_remaining: 1,
  });
  expect(await settle(source.save('2004-06-15', signal()))).toMatchObject({
    birth_date: '2004-06-15',
    edits_remaining: 0,
    zodiac: 'gemini',
  });
  expect(await settle(source.save('2004-06-15', signal()))).toMatchObject({
    edits_remaining: 0,
  });
  const pending = source.save('2004-07-15', signal());
  const rejected = expect(pending).rejects.toMatchObject({
    status: 409,
    code: 'BIRTH_DATE_EDIT_LIMIT',
  });
  await jest.runAllTimersAsync();
  await rejected;
  expect(await settle(source.load(signal()))).toMatchObject({
    birth_date: '2004-06-15',
    edits_remaining: 0,
  });
});
it.each([
  ['2012-11-15', false],
  ['2012-11-14', true],
  ['2004-02-30', false],
  ['2026-11-15', false],
] as const)(
  'applies the mock contract to %s without spending on rejection',
  async (date, accepted) => {
    jest.useFakeTimers();
    const source = createMockBirthDate();
    const pending = source.save(date, signal());
    if (accepted) {
      expect(await settle(pending)).toMatchObject({
        birth_date: date,
        edits_remaining: 0,
      });
    } else {
      const rejected = expect(pending).rejects.toMatchObject({ status: 422 });
      await jest.runAllTimersAsync();
      await rejected;
      expect(await settle(source.load(signal()))).toMatchObject({
        birth_date: '2004-05-14',
        edits_remaining: 1,
      });
    }
  },
);
it('cleans an aborted mock timer and listener without committing', async () => {
  jest.useFakeTimers();
  const source = createMockBirthDate('slow');
  const c = new AbortController();
  const cleanup = jest.spyOn(c.signal, 'removeEventListener');
  const pending = source.save('2004-06-15', c.signal);
  const rejected = expect(pending).rejects.toMatchObject({ kind: 'aborted' });
  c.abort();
  await rejected;
  expect(jest.getTimerCount()).toBe(0);
  expect(cleanup).toHaveBeenCalledWith('abort', expect.any(Function));
  expect(await settle(source.load(signal()))).toMatchObject({
    birth_date: '2004-05-14',
    edits_remaining: 1,
  });
});

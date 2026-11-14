import { afterEach, expect, it, jest } from '@jest/globals';
import { createMockReminder } from '../../mocks/reminder';
afterEach(() => {
  jest.useRealTimers();
});
it('does not change desired settings for an aborted save and clears its timer', async () => {
  jest.useFakeTimers();
  const mock = createMockReminder('slow'),
    controller = new AbortController();
  const pending = mock.save(
    { enabled: true, local_time: '23:45' },
    controller.signal,
  );
  const expected = expect(pending).rejects.toMatchObject({ kind: 'aborted' });
  controller.abort();
  await expected;
  await jest.runAllTimersAsync();
  expect(mock.readSnapshot()).toEqual({ enabled: false, local_time: null });
  expect(jest.getTimerCount()).toBe(0);
});
it('rejects invalid targets without changing the shared setting', async () => {
  jest.useFakeTimers();
  const mock = createMockReminder('enabled');
  const invalid = mock.save(
    { enabled: false, local_time: '23:00' },
    new AbortController().signal,
  );
  const expected = expect(invalid).rejects.toMatchObject({ status: 422 });
  await jest.runAllTimersAsync();
  await expected;
  expect(mock.readSnapshot()).toEqual({ enabled: true, local_time: '23:30' });
});

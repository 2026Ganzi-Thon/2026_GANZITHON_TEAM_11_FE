import { afterEach, expect, it, jest } from '@jest/globals';
import { createReceivedYarnController } from './controller';
import { createMockReceivedYarn } from '../../mocks/receivedYarn';
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});
it('ignores a stale presentation event while another modal owns the screen', async () => {
  jest.useFakeTimers();
  const actions = createMockReceivedYarn(),
    seen = jest.spyOn(actions, 'markSeen');
  const controller = createReceivedYarnController(actions);
  controller.start();
  await jest.runAllTimersAsync();
  controller.block(true);
  controller.shown();
  await jest.runAllTimersAsync();
  expect(seen).not.toHaveBeenCalled();
  controller.block(false);
  controller.shown();
  controller.shown();
  await jest.runAllTimersAsync();
  expect(seen).toHaveBeenCalledTimes(1);
  const result = actions.load(new AbortController().signal);
  await jest.runAllTimersAsync();
  expect(await result).toBeNull();
  controller.stop();
});

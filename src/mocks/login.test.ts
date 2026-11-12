import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { createMockLogin } from './login';

describe('login preview responses', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });
  const credentials = { email: 'preview@example.com', password: 'example' };
  it.each(['success', 'invalid', 'network'] as const)(
    'returns %s after a loading interval',
    async (scenario) => {
      const controller = new AbortController();
      const removed = jest.spyOn(controller.signal, 'removeEventListener');
      const operation = createMockLogin(scenario)(
        credentials,
        controller.signal,
      );
      const assertion =
        scenario === 'success'
          ? expect(operation).resolves.toBeUndefined()
          : expect(operation).rejects.toMatchObject(
              scenario === 'invalid'
                ? { kind: 'http', status: 401 }
                : { kind: 'network' },
            );
      await jest.advanceTimersByTimeAsync(800);
      await assertion;
      expect(jest.getTimerCount()).toBe(0);
      expect(removed).toHaveBeenCalledWith('abort', expect.any(Function));
    },
  );
  it('cancels without leaving its response timer or listener', async () => {
    const controller = new AbortController();
    const removed = jest.spyOn(controller.signal, 'removeEventListener');
    const assertion = expect(
      createMockLogin('success')(credentials, controller.signal),
    ).rejects.toMatchObject({ kind: 'aborted' });
    controller.abort();
    await assertion;
    expect(jest.getTimerCount()).toBe(0);
    expect(removed).toHaveBeenCalledWith('abort', expect.any(Function));
  });
});

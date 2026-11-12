import { describe, it, expect, jest } from '@jest/globals';
import { createMockMorning } from './morning';
describe('reflection memory lifecycle', () => {
  it('cancels delayed writes without mutating a night and cleans its timer', async () => {
    jest.useFakeTimers();
    try {
      const actions = createMockMorning('existing');
      const controller = new AbortController();
      const pending = actions.reflection.save(
        'preview-night',
        'smaller',
        controller.signal,
      );
      const failure = expect(pending).rejects.toMatchObject({
        kind: 'aborted',
      });
      controller.abort();
      await failure;
      expect(jest.getTimerCount()).toBe(0);
      const reading = actions.reflection.load(
        'preview-night',
        new AbortController().signal,
      );
      jest.advanceTimersByTime(650);
      expect((await reading).reflection).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
  it('keeps a saved answer when reloading a night', async () => {
    jest.useFakeTimers();
    try {
      const actions = createMockMorning('existing');
      const signal = new AbortController().signal;
      const saving = actions.reflection.save('preview-night', 'bigger', signal);
      jest.advanceTimersByTime(650);
      await saving;
      const reading = actions.reflection.load('preview-night', signal);
      jest.advanceTimersByTime(650);
      expect((await reading).reflection).toEqual({
        answer: 'bigger',
        message: '말해 줘서 고마워. 오늘은 조금 일찍 와서 같이 세자.',
      });
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});

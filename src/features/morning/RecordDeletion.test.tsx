import { expect, it, jest } from '@jest/globals';
import { act, render, screen, fireEvent } from '@testing-library/react-native';
import { createWorryDeletions } from '../worries/deletions';
import { ReflectionScreen } from './ReflectionScreen';
import type { ReflectionActions, ReflectionRecord } from './reflection';
const record: ReflectionRecord = {
  night: {
    id: 'n',
    night_date: '2026-11-10',
    category_id: 'career',
    worry_text: 'old worry',
    worry_saved_at: null,
    entrusted: true,
  },
  reflection: { answer: 'same', message: 'old reply' },
};
const source = () =>
  createWorryDeletions(
    { remove: async () => {} },
    { remove: async () => {}, check: async () => true },
  );
it('clears the saved selection and reply even when a later refresh returns the old record', async () => {
  const worries = source();
  const actions: ReflectionActions = {
    load: async () => record,
    save: async () => record.reflection!,
  };
  await render(
    <ReflectionScreen
      nightId="n"
      actions={actions}
      worries={worries}
      onBack={() => {}}
    />,
  );
  expect(screen.getByText('old reply')).toBeTruthy();
  await act(async () =>
    worries.records!.remove('n', new AbortController().signal),
  );
  expect(screen.queryByText('old reply')).toBeNull();
  expect(screen.queryByText('old worry')).toBeNull();
  expect(screen.queryAllByRole('radio')).toHaveLength(0);
});
it('ignores a non-abort-aware save completion after the record and reflection have been removed', async () => {
  const worries = source();
  let finish!: (r: NonNullable<ReflectionRecord['reflection']>) => void;
  const actions: ReflectionActions = {
    load: async () => ({ ...record, reflection: null }),
    save: jest.fn<ReflectionActions['save']>().mockImplementation(
      () =>
        new Promise((r) => {
          finish = r;
        }),
    ),
  };
  await render(
    <ReflectionScreen
      nightId="n"
      actions={actions}
      worries={worries}
      onBack={() => {}}
    />,
  );
  await fireEvent.press(screen.getByRole('radio', { name: '작아졌어요' }));
  await fireEvent.press(screen.getByRole('button', { name: '회고 저장하기' }));
  await act(async () =>
    worries.records!.remove('n', new AbortController().signal),
  );
  await act(async () => finish({ answer: 'smaller', message: 'late reply' }));
  expect(screen.queryByText('late reply')).toBeNull();
  expect(screen.queryByText('회고를 저장했어요.')).toBeNull();
});

import { expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { MyCardDeleteActions, Submission } from './types';
import { CardDeleteDialog } from './CardDeleteDialog';

const item: Submission = {
  id: 'own-card',
  kind: 'text',
  category_id: 'study',
  content: { text: '오늘도 여기까지 잘 왔어요.' },
  moderation_status: 'approved',
  rejection_reason: null,
  yarn_count: 12,
  created_at: '2026-11-07T01:00:00Z',
  revision: 1,
};
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
it('cancels with no delete on the cancel button or hardware back', async () => {
  const actions = { remove: jest.fn<MyCardDeleteActions['remove']>() },
    cancel = jest.fn();
  await render(
    <CardDeleteDialog
      item={item}
      actions={actions}
      onCancel={cancel}
      onDeleted={() => {}}
    />,
  );
  await press('취소');
  await fireEvent(screen.getByTestId('card-delete-modal'), 'requestClose');
  expect(cancel).toHaveBeenCalledTimes(2);
  expect(actions.remove).not.toHaveBeenCalled();
});
it('keeps one pending delete and blocks duplicate confirmation and dismissal until resolved', async () => {
  let resolve!: () => void;
  const actions = {
    remove: jest.fn<MyCardDeleteActions['remove']>().mockReturnValue(
      new Promise<void>((yes) => {
        resolve = yes;
      }),
    ),
  };
  const cancel = jest.fn(),
    deleted = jest.fn();
  await render(
    <CardDeleteDialog
      item={item}
      actions={actions}
      onCancel={cancel}
      onDeleted={deleted}
    />,
  );
  await press('지우기');
  expect(screen.getByRole('button', { name: '삭제 확인 중' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '취소' })).toBeDisabled();
  await press('삭제 확인 중');
  await press('취소');
  await fireEvent(screen.getByTestId('card-delete-modal'), 'requestClose');
  expect(actions.remove).toHaveBeenCalledTimes(1);
  expect(cancel).not.toHaveBeenCalled();
  expect(deleted).not.toHaveBeenCalled();
  await act(async () => resolve());
  expect(deleted).toHaveBeenCalledTimes(1);
});
it('keeps the same target on failure and retries its id instead of claiming deletion', async () => {
  const actions = {
    remove: jest
      .fn<MyCardDeleteActions['remove']>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined),
  };
  const deleted = jest.fn();
  await render(
    <CardDeleteDialog
      item={item}
      actions={actions}
      onCancel={() => {}}
      onDeleted={deleted}
    />,
  );
  await press('지우기');
  expect(screen.getByText('삭제 결과를 확인하지 못했어요')).toBeTruthy();
  expect(deleted).not.toHaveBeenCalled();
  await press('다시 지우기');
  expect(actions.remove.mock.calls.map(([id]) => id)).toEqual([
    'own-card',
    'own-card',
  ]);
  expect(deleted).toHaveBeenCalledTimes(1);
});
it.each(['resolve', 'reject'] as const)(
  'aborts on unmount and ignores late %s even if the provider ignores abort',
  async (outcome) => {
    let resolve!: () => void, reject!: (error: Error) => void;
    const actions = {
      remove: jest.fn<MyCardDeleteActions['remove']>().mockReturnValue(
        new Promise<void>((yes, no) => {
          resolve = yes;
          reject = no;
        }),
      ),
    };
    const deleted = jest.fn();
    const view = await render(
      <CardDeleteDialog
        item={item}
        actions={actions}
        onCancel={() => {}}
        onDeleted={deleted}
      />,
    );
    await press('지우기');
    await view.unmount();
    expect(actions.remove.mock.calls[0][1].aborted).toBe(true);
    await act(async () => {
      if (outcome === 'resolve') resolve();
      else reject(new Error('late'));
    });
    expect(deleted).not.toHaveBeenCalled();
  },
);

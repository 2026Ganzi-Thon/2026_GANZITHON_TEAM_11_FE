import { expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SheepDetailScreen } from '../flock/SheepDetailScreen';
import { ReflectionScreen } from '../morning/ReflectionScreen';
import type { SheepDetail, SheepDetailLoad } from '../flock/types';
import type {
  ReflectionActions,
  ReflectionRecord,
} from '../morning/reflection';
import { createWorryDeletions } from './deletions';
const detail: SheepDetail = {
  sheep: {
    id: 's',
    night_id: 'n',
    night_date: '2026-11-10',
    card_id: 'c',
    color_key: 'career',
  },
  card: {
    id: 'c',
    kind: 'text',
    available: true,
    content: { text: '카드 보존' },
    tone: 'warm',
    category_id: 'career',
    author_type: 'seed',
    author_label: null,
    viewer: { yarn_sent: false, fluff_saved: false, song_saved: false },
  },
  position: 1,
  sheep_count: 3,
  night: {
    night_date: '2026-11-10',
    worry_text: '원문',
    category_id: 'career',
    reflection: { answer: 'smaller', message: '저장된 답변' },
  },
};
const record: ReflectionRecord = {
  night: {
    id: 'n',
    night_date: '2026-11-10',
    worry_text: '원문',
    worry_saved_at: '2026-11-10T16:00:00Z',
    category_id: 'career',
    entrusted: true,
  },
  reflection: detail.night.reflection,
};
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
it('aborts deletion on source replacement, ignores late success and targets the new source only after a new confirmation', async () => {
  let finish!: () => void;
  const remove = jest.fn<() => Promise<void>>().mockImplementation(
    () =>
      new Promise<void>((r) => {
        finish = r;
      }),
  );
  const old = createWorryDeletions({ remove });
  const nextRemove = jest
    .fn<() => Promise<void>>()
    .mockResolvedValue(undefined);
  const next = createWorryDeletions({ remove: nextRemove });
  const load = jest.fn<SheepDetailLoad>().mockResolvedValue(detail);
  await render(
    <SheepDetailScreen
      sheepId="s"
      load={load}
      worries={old}
      onBack={() => {}}
    />,
  );
  await press('고민 삭제');
  await press('지우기');
  await screen.rerender(
    <SheepDetailScreen
      sheepId="s"
      load={load}
      worries={next}
      onBack={() => {}}
    />,
  );
  expect(screen.queryByTestId('worry-delete-modal')).toBeNull();
  const controllerSignal = (
    remove.mock.calls[0] as unknown as [string, AbortSignal]
  )[1];
  expect(controllerSignal.aborted).toBe(true);
  await act(async () => finish());
  expect(screen.getByText('원문')).toBeTruthy();
  expect(old.isDeleted('n')).toBe(false);
  expect(nextRemove).not.toHaveBeenCalled();
  await press('고민 삭제');
  await press('지우기');
  expect(next.isDeleted('n')).toBe(true);
  expect(screen.queryByText('원문')).toBeNull();
});
it('masks stale detail loads after confirmed deletion and invalidates an already cached original', async () => {
  let finish!: (d: SheepDetail) => void;
  const source = createWorryDeletions({ remove: async () => {} });
  const load = jest.fn<SheepDetailLoad>().mockImplementation(
    () =>
      new Promise((r) => {
        finish = (value) => r(value as never);
      }),
  );
  await render(
    <SheepDetailScreen
      sheepId="s"
      load={load}
      worries={source}
      onBack={() => {}}
    />,
  );
  await act(async () => {
    await source.remove('n', new AbortController().signal);
    finish(detail);
  });
  expect(screen.queryByText('원문')).toBeNull();
  expect(screen.getByText('저장된 답변')).toBeTruthy();
});
it.each(['load', 'save'] as const)(
  'blocks late reflection %s from restoring the original or form after deletion',
  async (phase) => {
    let finish!: (
      r: ReflectionRecord | NonNullable<ReflectionRecord['reflection']>,
    ) => void;
    const source = createWorryDeletions({ remove: async () => {} });
    const actions: ReflectionActions = {
      load: jest.fn<ReflectionActions['load']>().mockResolvedValue(record),
      save: jest.fn<ReflectionActions['save']>().mockImplementation(
        () =>
          new Promise((r) => {
            finish = (value) => r(value as never);
          }),
      ),
    };
    if (phase === 'load')
      actions.load = jest
        .fn<ReflectionActions['load']>()
        .mockImplementationOnce(
          () =>
            new Promise((r) => {
              finish = (value) => r(value as never);
            }),
        )
        .mockResolvedValue(record);
    await render(
      <ReflectionScreen
        nightId="n"
        actions={actions}
        worries={source}
        onBack={() => {}}
      />,
    );
    if (phase === 'save') {
      await fireEvent.press(screen.getByRole('radio', { name: '더 커졌어요' }));
      await press('회고 저장하기');
    }
    const pending =
      phase === 'save'
        ? (actions.save as jest.Mock<ReflectionActions['save']>).mock
            .calls[0][2]
        : (actions.load as jest.Mock<ReflectionActions['load']>).mock
            .calls[0][1];
    await act(async () => {
      await source.remove('n', new AbortController().signal);
    });
    expect(pending.aborted).toBe(true);
    await act(async () =>
      finish(
        phase === 'save' ? { answer: 'bigger', message: '늦은 답변' } : record,
      ),
    );
    expect(screen.queryByText('원문')).toBeNull();
    expect(screen.queryByText('늦은 답변')).toBeNull();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.getByText('저장된 답변')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '회고 저장하기' })).toBeNull();
  },
);
it('does not show a saved reply when no night record exists', async () => {
  const actions: ReflectionActions = {
    load: async () => ({
      night: null,
      reflection: { answer: 'same', message: '잘못 연결된 답변' },
    }),
    save: async () => {
      throw new Error('must not save');
    },
  };
  await render(
    <ReflectionScreen nightId="n" actions={actions} onBack={() => {}} />,
  );
  expect(screen.queryByText('잘못 연결된 답변')).toBeNull();
  expect(screen.queryAllByRole('radio')).toHaveLength(0);
});

import { describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ReflectionScreen } from './ReflectionScreen';
import type { ReflectionActions, ReflectionRecord } from './reflection';
import { ApiError } from '../../api/errors';
const record: ReflectionRecord = {
  night: {
    id: 'n1',
    night_date: '2026-11-10',
    category_id: 'career',
    worry_text: '면접이 걱정돼요.',
    worry_saved_at: '2026-11-10T16:12:00Z',
    entrusted: true,
  },
  reflection: null,
};
const setup = (patch: Partial<jest.Mocked<ReflectionActions>> = {}) => ({
  load: jest.fn<ReflectionActions['load']>().mockResolvedValue(record),
  save: jest.fn<ReflectionActions['save']>().mockResolvedValue({
    answer: 'smaller',
    message: '봐, 밤엔 커 보였던 거야.',
  }),
  ...patch,
});
const press = (label: string) =>
  fireEvent.press(screen.getByRole('button', { name: label }));
describe('morning reflection', () => {
  it('shows six choices and only confirms after saving', async () => {
    let resolve!: (v: { answer: 'smaller'; message: string }) => void;
    const actions = setup({
      save: jest.fn<ReflectionActions['save']>().mockImplementation(
        () =>
          new Promise((r) => {
            resolve = r;
          }),
      ),
    });
    await render(
      <ReflectionScreen nightId="n1" actions={actions} onBack={() => {}} />,
    );
    expect(screen.getByText('면접이 걱정돼요.')).toBeTruthy();
    expect(screen.getByText(/01:12 · 맡긴 걱정/)).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(6);
    expect(
      screen.getByRole('button', { name: '회고 저장하기' }),
    ).toBeDisabled();
    await fireEvent.press(screen.getByRole('radio', { name: '작아졌어요' }));
    await press('회고 저장하기');
    await press('회고 저장하기');
    expect(actions.save).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('회고를 저장했어요.')).toBeNull();
    await act(async () =>
      resolve({ answer: 'smaller', message: '서버에서 온 답변' }),
    );
    expect(screen.getByText('서버에서 온 답변')).toBeTruthy();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(
      screen.getByRole('button', { name: '회고 다시 선택하기' }),
    ).toBeTruthy();
    expect(screen.getByText('회고를 저장했어요.')).toBeTruthy();
  });
  it('retains selection on failure and retries', async () => {
    const actions = setup();
    actions.save.mockRejectedValueOnce(new ApiError('network'));
    await render(
      <ReflectionScreen nightId="n1" actions={actions} onBack={() => {}} />,
    );
    await fireEvent.press(screen.getByRole('radio', { name: '작아졌어요' }));
    await press('회고 저장하기');
    expect(await screen.findByText(/저장하지 못했어요/)).toBeTruthy();
    expect(screen.getByRole('radio', { name: '작아졌어요' })).toBeChecked();
    await press('회고 저장하기');
    expect(await screen.findByText('회고를 저장했어요.')).toBeTruthy();
  });
  it.each(['none', 'deleted'])(
    'hides new input when %s and preserves saved reflection only for deleted originals',
    async (mode) => {
      const actions = setup({
        load: jest.fn<ReflectionActions['load']>().mockResolvedValue({
          ...record,
          night: {
            ...record.night!,
            category_id: mode === 'none' ? 'none' : 'career',
            worry_text: mode === 'none' ? 'hidden' : null,
          },
          reflection: { answer: 'same', message: 'residual' },
        }),
      });
      await render(
        <ReflectionScreen nightId="n1" actions={actions} onBack={() => {}} />,
      );
      expect(screen.queryAllByRole('radio')).toHaveLength(0);
      expect(screen.queryByText('hidden')).toBeNull();
      if (mode === 'none') expect(screen.queryByText('residual')).toBeNull();
      else expect(screen.getByText('residual')).toBeTruthy();
    },
  );
  it('skips without saving and aborts an active save on close', async () => {
    const actions = setup({
      save: jest
        .fn<ReflectionActions['save']>()
        .mockImplementation(() => new Promise(() => {})),
    });
    const back = jest.fn();
    await render(
      <ReflectionScreen nightId="n1" actions={actions} onBack={back} />,
    );
    await fireEvent.press(screen.getByRole('radio', { name: '작아졌어요' }));
    await press('회고 저장하기');
    await press('양떼로 돌아가기');
    expect(actions.save.mock.calls[0][2].aborted).toBe(true);
    expect(back).toHaveBeenCalledTimes(1);
  });
  it('skips an unanswered record without writing', async () => {
    const actions = setup();
    const back = jest.fn();
    await render(
      <ReflectionScreen nightId="n1" actions={actions} onBack={back} />,
    );
    await press('건너뛰고 양떼 보기');
    expect(actions.save).not.toHaveBeenCalled();
    expect(back).toHaveBeenCalledTimes(1);
  });
  it('loads existing answer without writing again', async () => {
    const actions = setup({
      load: jest.fn<ReflectionActions['load']>().mockResolvedValue({
        ...record,
        reflection: {
          answer: 'bigger',
          message: '괜찮아. 아직 밤이 길잖아.',
        },
      }),
    });
    await render(
      <ReflectionScreen nightId="n1" actions={actions} onBack={() => {}} />,
    );
    expect(screen.getByRole('radio', { name: '더 커졌어요' })).toBeChecked();
    expect(screen.getByText('괜찮아. 아직 밤이 길잖아.')).toBeTruthy();
    expect(actions.save).not.toHaveBeenCalled();
  });
  it('retries loading and rejects a response from another night', async () => {
    const actions = setup();
    actions.load
      .mockRejectedValueOnce(new ApiError('network'))
      .mockResolvedValueOnce({
        ...record,
        night: { ...record.night!, id: 'wrong' },
      });
    await render(
      <ReflectionScreen nightId="n1" actions={actions} onBack={() => {}} />,
    );
    await press('다시 불러오기');
    expect(
      await screen.findByRole('button', { name: '다시 불러오기' }),
    ).toBeTruthy();
    expect(screen.queryByText('면접이 걱정돼요.')).toBeNull();
  });
  it('clears private content when saving becomes unavailable', async () => {
    const actions = setup();
    actions.save.mockRejectedValue(
      new ApiError('http', { status: 409, code: 'REFLECTION_NOT_AVAILABLE' }),
    );
    await render(
      <ReflectionScreen nightId="n1" actions={actions} onBack={() => {}} />,
    );
    await fireEvent.press(screen.getByRole('radio', { name: '작아졌어요' }));
    await press('회고 저장하기');
    expect(
      await screen.findByText('지금은 이 회고를 남길 수 없어요.'),
    ).toBeTruthy();
    expect(screen.queryByText('면접이 걱정돼요.')).toBeNull();
  });
  it('aborts old loads and ignores late results after the night changes', async () => {
    let resolve!: (v: ReflectionRecord) => void;
    const actions = setup({
      load: jest
        .fn<ReflectionActions['load']>()
        .mockImplementationOnce(
          () =>
            new Promise((r) => {
              resolve = r;
            }),
        )
        .mockResolvedValue({
          ...record,
          night: { ...record.night!, id: 'n2', worry_text: '두 번째 밤' },
        }),
    });
    const view = await render(
      <ReflectionScreen nightId="n1" actions={actions} onBack={() => {}} />,
    );
    await view.rerender(
      <ReflectionScreen nightId="n2" actions={actions} onBack={() => {}} />,
    );
    expect(actions.load.mock.calls[0][1].aborted).toBe(true);
    await act(async () => resolve(record));
    expect(screen.getByText('두 번째 밤')).toBeTruthy();
    expect(screen.queryByText('면접이 걱정돼요.')).toBeNull();
  });
  it('aborts loading on unmount', async () => {
    const actions = setup({
      load: jest
        .fn<ReflectionActions['load']>()
        .mockImplementation(() => new Promise(() => {})),
    });
    const view = await render(
      <ReflectionScreen nightId="n1" actions={actions} onBack={() => {}} />,
    );
    await view.unmount();
    expect(actions.load.mock.calls[0][1].aborted).toBe(true);
  });
  it('separates saved A from unsaved B across failure, retry and another edit', async () => {
    const actions = setup({
      load: jest.fn<ReflectionActions['load']>().mockResolvedValue({
        ...record,
        reflection: { answer: 'smaller', message: '이전 답변 A' },
      }),
    });
    actions.save
      .mockRejectedValueOnce(new ApiError('network'))
      .mockResolvedValue({ answer: 'bigger', message: '새 답변 B' });
    await render(
      <ReflectionScreen nightId="n1" actions={actions} onBack={() => {}} />,
    );
    expect(screen.getByText('저장된 회고 · 작아졌어요')).toBeTruthy();
    expect(screen.getByText('이전 답변 A')).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: '더 커졌어요' }));
    expect(screen.queryByText('이전 답변 A')).toBeNull();
    expect(screen.getByText('아직 저장하지 않은 선택이에요.')).toBeTruthy();
    await press('회고 저장하기');
    expect(await screen.findByText(/저장하지 못했어요/)).toBeTruthy();
    expect(screen.getByRole('radio', { name: '더 커졌어요' })).toBeChecked();
    expect(screen.queryByText('이전 답변 A')).toBeNull();
    await press('회고 저장하기');
    expect(await screen.findByText('새 답변 B')).toBeTruthy();
    expect(screen.getByText('저장한 회고 · 더 커졌어요')).toBeTruthy();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.queryByText('이전 답변 A')).toBeNull();
    await press('회고 다시 선택하기');
    expect(screen.getByText('저장된 회고 · 더 커졌어요')).toBeTruthy();
    expect(screen.getByRole('radio', { name: '더 커졌어요' })).toBeChecked();
    await fireEvent.press(screen.getByRole('radio', { name: '작아졌어요' }));
    expect(screen.queryByText('새 답변 B')).toBeNull();
  });
  it('can return to saved A without writing the abandoned choice B', async () => {
    const actions = setup({
      load: jest.fn<ReflectionActions['load']>().mockResolvedValue({
        ...record,
        reflection: { answer: 'smaller', message: '저장된 답변 A' },
      }),
    });
    await render(
      <ReflectionScreen nightId="n1" actions={actions} onBack={() => {}} />,
    );
    await fireEvent.press(screen.getByRole('radio', { name: '더 커졌어요' }));
    expect(screen.queryByText('저장된 답변 A')).toBeNull();
    await fireEvent.press(screen.getByRole('radio', { name: '작아졌어요' }));
    expect(screen.getByText('저장된 답변 A')).toBeTruthy();
    expect(screen.queryByText('아직 저장하지 않은 선택이에요.')).toBeNull();
    expect(actions.save).not.toHaveBeenCalled();
  });
});

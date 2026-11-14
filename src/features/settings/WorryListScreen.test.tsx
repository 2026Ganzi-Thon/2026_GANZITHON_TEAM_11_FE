import { expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { WorryListScreen } from './WorryListScreen';
import type { WorryRecord, WorryPage, WorryListActions } from './types';
const item: WorryRecord = {
  night_id: 'n1',
  night_date: '2026-11-10',
  category_id: 'career',
  worry_text: '처음 기록',
  reflection: null,
};
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
it('preserves records after a more-page failure and retries the same cursor without duplicating nights', async () => {
  const load = jest
    .fn<WorryListActions['load']>()
    .mockRejectedValueOnce(new Error('private detail'))
    .mockResolvedValueOnce({ items: [item], next_cursor: 'next' })
    .mockRejectedValueOnce(new Error('more failure'))
    .mockResolvedValueOnce({
      items: [
        { ...item, worry_text: '갱신된 기록' },
        { ...item, night_id: 'n2', worry_text: '다음 기록' },
      ],
      next_cursor: null,
    });
  await render(
    <WorryListScreen actions={{ load }} total={2} onBack={() => {}} />,
  );
  expect(screen.getByText('고민 기록을 불러오지 못했어요.')).toBeTruthy();
  expect(screen.queryByText('private detail')).toBeNull();
  await press('고민 기록 다시 불러오기');
  await press('더 보기');
  expect(screen.getByText('처음 기록')).toBeTruthy();
  expect(screen.getByText(/앞의 기록은 그대로/)).toBeTruthy();
  await press('더 보기 다시 시도');
  expect(screen.getByText('갱신된 기록')).toBeTruthy();
  expect(screen.getAllByText('다음 기록')).toHaveLength(1);
  expect(screen.queryByText('처음 기록')).toBeNull();
  expect(screen.queryByRole('button', { name: '더 보기' })).toBeNull();
  expect(load.mock.calls.map((c) => c[0])).toEqual([
    {},
    {},
    { cursor: 'next' },
    { cursor: 'next' },
  ]);
});
it('blocks repeated pending pagination and reports a cursor loop without discarding loaded rows', async () => {
  let finish!: (page: WorryPage) => void;
  const load = jest
    .fn<WorryListActions['load']>()
    .mockResolvedValueOnce({ items: [item], next_cursor: 'a' })
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          finish = r;
        }),
    );
  await render(
    <WorryListScreen actions={{ load }} total={3} onBack={() => {}} />,
  );
  await press('더 보기');
  await press('더 보기');
  expect(load).toHaveBeenCalledTimes(2);
  await act(async () =>
    finish({
      items: [
        { ...item, night_id: 'n2', worry_text: '노출하면 안 되는 페이지' },
      ],
      next_cursor: 'a',
    }),
  );
  expect(screen.getByText('처음 기록')).toBeTruthy();
  expect(screen.queryByText('노출하면 안 되는 페이지')).toBeNull();
  expect(
    screen.getByRole('button', { name: '더 보기 다시 시도' }),
  ).toBeTruthy();
});
it.each(['source', 'back', 'unmount'] as const)(
  'cancels on %s and ignores late original text',
  async (mode) => {
    let finish!: (page: WorryPage) => void;
    const load = jest.fn<WorryListActions['load']>().mockImplementation(
      () =>
        new Promise((r) => {
          finish = r;
        }),
    );
    const back = jest.fn();
    await render(
      <WorryListScreen actions={{ load }} total={3} onBack={back} />,
    );
    if (mode === 'source')
      await screen.rerender(
        <WorryListScreen
          actions={{ load: async () => ({ items: [], next_cursor: null }) }}
          total={0}
          onBack={back}
        />,
      );
    else if (mode === 'back') await press('설정으로 돌아가기');
    else await screen.unmount();
    expect(load.mock.calls[0][1].aborted).toBe(true);
    await act(async () => finish({ items: [item], next_cursor: null }));
    if (mode !== 'unmount') expect(screen.queryByText('처음 기록')).toBeNull();
    if (mode === 'source')
      expect(screen.getByText('저장된 고민 없음')).toBeTruthy();
    if (mode === 'back') expect(back).toHaveBeenCalledTimes(1);
  },
);
it.each([
  { worry_text: '' },
  { category_id: 'none' },
  { night_id: '' },
  { reflection: { answer: 'unknown', message: 'bad' } },
])(
  'rejects invalid rows without exposing their original (%j)',
  async (invalid) => {
    const actions: WorryListActions = {
      load: async () => ({
        items: [{ ...item, ...invalid } as WorryRecord],
        next_cursor: null,
      }),
    };
    await render(
      <WorryListScreen actions={actions} total={1} onBack={() => {}} />,
    );
    expect(screen.getByText('고민 기록을 불러오지 못했어요.')).toBeTruthy();
    expect(screen.queryByText('처음 기록')).toBeNull();
  },
);

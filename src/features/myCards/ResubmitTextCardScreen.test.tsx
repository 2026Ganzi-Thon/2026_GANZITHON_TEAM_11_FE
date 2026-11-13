import { afterEach, expect, it, jest } from '@jest/globals';
import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';
import { ApiError } from '../../api/errors';
import { createMockMyCards, type MyCardsScenario } from '../../mocks/myCards';
import { MyCardsScreen } from './MyCardsScreen';
import { ResubmitTextCardScreen } from './ResubmitTextCardScreen';
import type { MyCardResubmitActions, Submission } from './types';

const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
const tick = (ms = 400) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
const edit = (text: string) =>
  fireEvent.changeText(screen.getByLabelText('짧은 글 수정'), text);
const original: Extract<Submission, { kind: 'text' }> = {
  id: 'my-text-3',
  kind: 'text',
  category_id: 'career',
  content: { text: '원래 글' },
  moderation_status: 'rejected',
  rejection_reason: '내 경험으로 적어 주세요.',
  yarn_count: 0,
  revision: 1,
  created_at: '2026-11-05T01:00:00Z',
};
async function open(scenario: MyCardsScenario = 'success') {
  jest.useFakeTimers();
  const actions = createMockMyCards(scenario);
  const submit = jest.spyOn(actions, 'resubmit');
  const view = await render(
    <MyCardsScreen
      actions={actions}
      deletions={actions}
      resubmissions={actions}
      onBack={() => {}}
    />,
  );
  await tick();
  await fireEvent.press(screen.getByRole('tab', { name: '반려' }));
  await tick();
  await press('고쳐서 다시 내기');
  return { actions, submit, ...view };
}
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});
it('opens rejected text with original reason/body/category, resubmits the same ID and refreshes pending filters', async () => {
  const { actions, submit } = await open();
  expect(
    within(screen.getByTestId('resubmit-text-modal')).getByText(
      /개인 연락을 유도하는 문장을 빼고/,
    ),
  ).toBeTruthy();
  expect(screen.getByLabelText('짧은 글 수정')).toHaveDisplayValue(/나도 결과/);
  await edit('내 속도로 쉬어도 괜찮아요.');
  await press('분류 변경');
  await fireEvent.press(screen.getByRole('radio', { name: '학업' }));
  await press('다시 검수 요청');
  await tick();
  expect(screen.getByText('다시 검수를 맡겼어요')).toBeTruthy();
  expect(submit).toHaveBeenCalledWith(
    'my-text-3',
    {
      kind: 'text',
      category_id: 'study',
      content: { text: '내 속도로 쉬어도 괜찮아요.' },
    },
    expect.any(String),
    expect.any(AbortSignal),
  );
  await press('내 카드로 돌아가기');
  await tick();
  expect(screen.getByText('반려된 카드가 없어요')).toBeTruthy();
  await fireEvent.press(screen.getByRole('tab', { name: '검수 중' }));
  await tick();
  expect(screen.getByText('내 속도로 쉬어도 괜찮아요.')).toBeTruthy();
  const page = actions.load({}, new AbortController().signal);
  await tick();
  const items = (await page).items.filter((item) => item.id === 'my-text-3');
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({
    moderation_status: 'pending',
    rejection_reason: null,
    revision: 2,
  });
});
it('retains edits across close/reopen, reuses the operation key for unchanged retry and changes it after an edit', async () => {
  const { submit } = await open('resubmit-retry');
  await edit('수정한 내 경험');
  await press('목록으로');
  await press('고쳐서 다시 내기');
  expect(screen.getByLabelText('짧은 글 수정')).toHaveDisplayValue(
    '수정한 내 경험',
  );
  await press('다시 검수 요청');
  await tick();
  expect(screen.getByText('접수를 확인하지 못했어요')).toBeTruthy();
  await edit('다시 수정한 경험');
  await press('다시 검수 요청');
  await tick();
  expect(submit.mock.calls[1][2]).not.toBe(submit.mock.calls[0][2]);
});
it('retries a lost response with the same key without creating a duplicate or advancing revision twice', async () => {
  const { actions, submit } = await open('lost-resubmit');
  await edit('수정한 내 경험');
  await press('다시 검수 요청');
  await tick();
  expect(screen.getByText('접수를 확인하지 못했어요')).toBeTruthy();
  await press('다시 검수 요청');
  await tick();
  expect(screen.getByText('다시 검수를 맡겼어요')).toBeTruthy();
  expect(submit.mock.calls[1][2]).toBe(submit.mock.calls[0][2]);
  const page = actions.load({}, new AbortController().signal);
  await tick();
  expect(
    (await page).items.find((item) => item.id === 'my-text-3')?.revision,
  ).toBe(2);
});
it('blocks editing, duplicate submit and modal back while a resubmission is pending', async () => {
  const { submit } = await open('slow-resubmit');
  await press('다시 검수 요청');
  expect(screen.getByLabelText('짧은 글 수정')).toHaveProp('editable', false);
  expect(screen.getByRole('button', { name: '목록으로' })).toBeDisabled();
  expect(
    screen.getByText('접수를 확인하고 있어요. 잠시 기다려 주세요.'),
  ).toBeTruthy();
  await press('다시 검수 요청');
  await fireEvent(screen.getByTestId('resubmit-text-modal'), 'requestClose');
  expect(submit).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('짧은 글 수정')).toBeTruthy();
  await tick(5000);
  expect(screen.getByText('다시 검수를 맡겼어요')).toBeTruthy();
});
it.each(['resubmit-approved', 'resubmit-deleted'] as const)(
  'blocks another submission and refreshes latest list on %s',
  async (scenario) => {
    const { submit } = await open(scenario);
    await press('다시 검수 요청');
    await tick();
    expect(
      screen.getByRole('button', { name: '다시 검수 요청' }),
    ).toBeDisabled();
    await press('다시 검수 요청');
    expect(submit).toHaveBeenCalledTimes(1);
    await press('최신 목록 확인');
    await tick();
    expect(screen.getByText('반려된 카드가 없어요')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: '고쳐서 다시 내기' }),
    ).toBeNull();
  },
);
it.each(['resubmit-field', 'resubmit-safety', 'resubmit-support'] as const)(
  'keeps the draft when %s prevents resubmission',
  async (scenario) => {
    await open(scenario);
    await edit('실패해도 남아 있는 경험');
    await press('다시 검수 요청');
    await tick();
    expect(screen.queryByText('다시 검수를 맡겼어요')).toBeNull();
    if (scenario === 'resubmit-support') await press('쓰던 글로 돌아가기');
    expect(screen.getByLabelText('짧은 글 수정')).toHaveDisplayValue(
      '실패해도 남아 있는 경험',
    );
    await edit('다시 고친 경험');
    await press('다시 검수 요청');
    await tick();
    expect(screen.getByText('다시 검수를 맡겼어요')).toBeTruthy();
  },
);
it('rejects empty/over-limit text and counts trimmed Unicode characters using the existing 200-character preview limit', async () => {
  const { submit } = await open();
  await edit('  ');
  expect(screen.getByRole('button', { name: '다시 검수 요청' })).toBeDisabled();
  await edit('양'.repeat(201));
  expect(screen.getByRole('button', { name: '다시 검수 요청' })).toBeDisabled();
  await edit('  ' + '🐑'.repeat(200) + '  ');
  expect(screen.getByText('200 / 200')).toBeTruthy();
  expect(screen.getByRole('button', { name: '다시 검수 요청' })).toBeEnabled();
  expect(submit).not.toHaveBeenCalled();
});
it.each(['id', 'category_id', 'content', 'moderation_status'] as const)(
  'rejects a receipt with mismatched %s rather than claiming success',
  async (field) => {
    const actions = createMockMyCards();
    const receipt = {
      id: original.id,
      kind: 'text' as const,
      category_id: 'career' as const,
      content: original.content,
      moderation_status: 'pending' as const,
    };
    const invalid = {
      id: 'different-id',
      category_id: 'study',
      content: { text: 'different-body' },
      moderation_status: 'approved',
    };
    const resubmit = jest
      .fn<MyCardResubmitActions['resubmit']>()
      .mockResolvedValue({
        ...receipt,
        [field]: invalid[field],
      } as typeof receipt);
    await render(
      <ResubmitTextCardScreen
        item={original}
        actions={{ ...actions, resubmit }}
        onClose={() => {}}
        onRefresh={() => {}}
      />,
    );
    await press('다시 검수 요청');
    expect(screen.getByText('접수를 확인하지 못했어요')).toBeTruthy();
    expect(screen.queryByText('다시 검수를 맡겼어요')).toBeNull();
  },
);
it.each(['resolve', 'reject'] as const)(
  'aborts on source replacement and ignores late %s',
  async (outcome) => {
    let resolve!: (
        value: Awaited<ReturnType<MyCardResubmitActions['resubmit']>>,
      ) => void,
      reject!: (error: Error) => void;
    const actions = createMockMyCards();
    const resubmit = jest.spyOn(actions, 'resubmit').mockImplementation(
      () =>
        new Promise((yes, no) => {
          resolve = yes;
          reject = no;
        }),
    );
    jest.useFakeTimers();
    const view = await render(
      <MyCardsScreen
        actions={actions}
        resubmissions={actions}
        onBack={() => {}}
      />,
    );
    await tick();
    await press('고쳐서 다시 내기');
    await press('다시 검수 요청');
    const next = createMockMyCards('empty');
    await view.rerender(
      <MyCardsScreen actions={next} resubmissions={next} onBack={() => {}} />,
    );
    expect(resubmit.mock.calls[0][3].aborted).toBe(true);
    await act(async () =>
      outcome === 'resolve'
        ? resolve({
            id: original.id,
            kind: 'text',
            category_id: 'career',
            content: original.content,
            moderation_status: 'pending',
          })
        : reject(new ApiError('network')),
    );
    await tick();
    expect(screen.getByText('아직 쓴 카드가 없어요')).toBeTruthy();
    expect(screen.queryByText('다시 검수를 맡겼어요')).toBeNull();
  },
);

it('refreshes after confirmed resubmission without restoring the rejected row when the refresh first fails', async () => {
  await open('resubmit-refresh-retry');
  await edit('확인된 수정');
  await press('다시 검수 요청');
  await tick();
  await press('내 카드로 돌아가기');
  await tick();
  expect(screen.getByText('목록을 다시 확인하지 못했어요')).toBeTruthy();
  expect(screen.queryByRole('button', { name: '고쳐서 다시 내기' })).toBeNull();
  await press('목록 다시 확인');
  await tick();
  expect(screen.getByText('반려된 카드가 없어요')).toBeTruthy();
});
it('offers editing only for rejected text, leaving pending/approved text and rejected songs without an edit action', async () => {
  jest.useFakeTimers();
  const actions = createMockMyCards();
  const rejectedSong: Submission = {
    ...original,
    kind: 'song',
    id: 'rejected-song',
    content: {
      recommendation: null,
      track: {
        id: 'song',
        title: '노래',
        artist: '가수',
        cover_url: null,
        spotify_search_url: '',
      },
    },
  };
  const load = jest.fn<typeof actions.load>().mockResolvedValue({
    items: [
      original,
      { ...original, id: 'approved', moderation_status: 'approved' },
      { ...original, id: 'pending', moderation_status: 'pending' },
      rejectedSong,
    ],
    next_cursor: null,
  });
  await render(
    <MyCardsScreen
      actions={{ load }}
      resubmissions={actions}
      onBack={() => {}}
    />,
  );
  expect(
    screen.getAllByRole('button', { name: '고쳐서 다시 내기' }),
  ).toHaveLength(1);
});
it('does not overwrite a committed pending card when the user edits after a lost response', async () => {
  const { actions, submit } = await open('lost-resubmit');
  await edit('처음 수정한 글');
  await press('다시 검수 요청');
  await tick();
  await edit('응답을 못 받은 뒤 바꾼 글');
  await press('다시 검수 요청');
  await tick();
  expect(submit.mock.calls[1][2]).not.toBe(submit.mock.calls[0][2]);
  expect(screen.getByText('카드의 최신 상태를 확인해 주세요')).toBeTruthy();
  expect(screen.getByRole('button', { name: '다시 검수 요청' })).toBeDisabled();
  const page = actions.load({}, new AbortController().signal);
  await tick();
  expect(
    (await page).items.find((item) => item.id === 'my-text-3'),
  ).toMatchObject({
    content: { text: '처음 수정한 글' },
    revision: 2,
    moderation_status: 'pending',
  });
});

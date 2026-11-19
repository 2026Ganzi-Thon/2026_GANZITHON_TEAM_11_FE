import { afterEach, expect, it, jest } from '@jest/globals';
import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';
import { createMockMyCards, type MyCardsScenario } from '../../mocks/myCards';
import { MyCardsWritingFlow } from './MyCardsWritingFlow';
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
const tick = (ms?: number) =>
  act(async () => {
    if (ms === undefined) await jest.runAllTimersAsync();
    else await jest.advanceTimersByTimeAsync(ms);
  });
const edit = (value: string) =>
  fireEvent.changeText(screen.getByLabelText('추천 한 줄'), value);
async function open(scenario = 'song-resubmit') {
  jest.useFakeTimers();
  const source = createMockMyCards(scenario as MyCardsScenario);
  const view = await render(
    <MyCardsWritingFlow source={source} onBack={() => {}} />,
  );
  await tick();
  await fireEvent.press(screen.getByRole('tab', { name: '반려' }));
  await tick();
  await press('노래 고쳐서 다시 내기');
  return { source, ...view };
}
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});
it('edits rejected song, category and recommendation on the same ID and returns it to pending in the shared list', async () => {
  const { source } = await open();
  const modal = within(screen.getByTestId('song-card-modal'));
  expect(modal.getByText(/가사를 옮기지 말고/)).toBeTruthy();
  expect(screen.getByRole('radio', { name: '밤편지 · 아이유' })).toBeChecked();
  expect(screen.getByRole('radio', { name: '취업' })).toBeChecked();
  expect(screen.getByLabelText('추천 한 줄')).toHaveDisplayValue(
    '복잡한 하루를 마치고 들었어요.',
  );
  await fireEvent.press(screen.getByRole('radio', { name: '학업' }));
  await fireEvent.changeText(
    screen.getByLabelText('곡 이름 또는 가수 검색'),
    '밤편지',
  );
  await tick();
  await fireEvent.press(
    screen.getByRole('radio', { name: '밤편지 (Live) · 아이유' }),
  );
  await edit('  공부를 마친 밤에 조용히 들었어요.  ');
  await press('다시 검수 요청');
  await tick();
  expect(
    screen.getByRole('header', { name: '다시 검수를 맡겼어요' }),
  ).toBeTruthy();
  await press('내 카드로 돌아가기');
  await tick();
  expect(
    screen.queryByRole('button', { name: '노래 고쳐서 다시 내기' }),
  ).toBeNull();
  await fireEvent.press(screen.getByRole('tab', { name: '검수 중' }));
  await tick();
  expect(screen.getByText('밤편지 (Live) · 아이유')).toBeTruthy();
  const page = source.load({ status: 'pending' }, new AbortController().signal);
  await tick();
  expect((await page).items.filter((x) => x.id === 'my-song-2')).toEqual([
    expect.objectContaining({
      kind: 'song',
      category_id: 'study',
      moderation_status: 'pending',
      revision: 2,
      rejection_reason: null,
      content: expect.objectContaining({
        track: expect.objectContaining({ id: 'preview-track-2' }),
        recommendation: '공부를 마친 밤에 조용히 들었어요.',
      }),
    }),
  ]);
});
it('keeps a cancelled draft and key and prevents empty or over-limit recommendation from submission', async () => {
  const { source } = await open();
  await edit('🐑'.repeat(51));
  expect(screen.getByRole('button', { name: '다시 검수 요청' })).toBeDisabled();
  await edit(' ');
  expect(screen.getByRole('button', { name: '다시 검수 요청' })).toBeDisabled();
  await edit('고쳐 쓰는 추천');
  const p = source.load({ status: 'rejected' }, new AbortController().signal);
  await tick();
  const item = (await p).items.find((x) => x.id === 'my-song-2')!;
  const writer = source.createSongResubmitSession!(
    item as Extract<typeof item, { kind: 'song' }>,
  );
  const key = writer.readDraft().operationKey;
  await press('이전');
  await press('노래 고쳐서 다시 내기');
  expect(screen.getByLabelText('추천 한 줄')).toHaveDisplayValue(
    '고쳐 쓰는 추천',
  );
  expect(writer.readDraft().operationKey).toBe(key);
});
it.each([false, true])(
  'recovers the original lost receipt after editing, close/reopen and original restored=%s without a second mutation',
  async (restore) => {
    const { source } = await open('song-lost-resubmit');
    await edit('처음 보낸 추천');
    await press('다시 검수 요청');
    await tick();
    expect(screen.getByText('접수를 확인하지 못했어요')).toBeTruthy();
    await edit('응답을 기다리다 바꾼 추천');
    if (restore) await edit('처음 보낸 추천');
    await press('이전');
    await press('노래 고쳐서 다시 내기');
    expect(screen.getByLabelText('추천 한 줄')).toHaveDisplayValue(
      restore ? '처음 보낸 추천' : '응답을 기다리다 바꾼 추천',
    );
    expect(screen.getByText(/처음 보낸 내용: 밤편지 · 아이유/)).toBeTruthy();
    await press('이전 접수 확인');
    await tick();
    expect(screen.getByText('다시 검수를 맡겼어요')).toBeTruthy();
    await press('내 카드로 돌아가기');
    await tick();
    const p = source.load({ status: 'pending' }, new AbortController().signal);
    await tick();
    const items = (await p).items.filter((x) => x.id === 'my-song-2');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      revision: 2,
      content: { recommendation: '처음 보낸 추천' },
    });
    await press('카드 쓰기');
    expect(
      screen.getByRole('header', { name: '누구에게 남길까요?' }),
    ).toBeTruthy();
  },
);
it('locks duplicate submission and modal back while a delayed resubmission is pending', async () => {
  await open('song-slow-resubmit');
  await press('다시 검수 요청');
  expect(screen.getByLabelText('추천 한 줄')).toHaveProp('editable', false);
  expect(screen.getByRole('radio', { name: '학업' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '이전' })).toBeDisabled();
  await fireEvent(screen.getByTestId('song-card-modal'), 'requestClose');
  await press('다시 검수 요청');
  expect(screen.getByLabelText('추천 한 줄')).toBeTruthy();
  await tick(5000);
  expect(screen.getByText('다시 검수를 맡겼어요')).toBeTruthy();
});
it.each(['song-resubmit-approved', 'song-resubmit-deleted'])(
  'blocks retry and refreshes the list when card status changed: %s',
  async (scenario) => {
    await open(scenario);
    await press('다시 검수 요청');
    await tick();
    expect(
      screen.getByRole('button', { name: '다시 검수 요청' }),
    ).toBeDisabled();
    expect(screen.getByLabelText('추천 한 줄')).toHaveProp('editable', false);
    await press('최신 목록 확인');
    await tick();
    expect(screen.queryByTestId('song-card-modal')).toBeNull();
    expect(
      screen.queryByRole('button', { name: '노래 고쳐서 다시 내기' }),
    ).toBeNull();
  },
);
it('shows field errors by submit while retaining edits and permits corrected retry', async () => {
  await open('song-resubmit-field');
  await edit('수정 중인 추천');
  await press('다시 검수 요청');
  await tick();
  expect(screen.getByText('추천 문장을 본인의 말로 적어 주세요.')).toBeTruthy();
  expect(screen.getByLabelText('추천 한 줄')).toHaveDisplayValue(
    '수정 중인 추천',
  );
  await edit('내 경험으로 다시 적은 추천');
  await press('다시 검수 요청');
  await tick();
  expect(screen.getByText('다시 검수를 맡겼어요')).toBeTruthy();
});
it('aborts a previous source and ignores its late success after account replacement', async () => {
  const { source, rerender } = await open();
  const p = source.load({ status: 'rejected' }, new AbortController().signal);
  await tick();
  const item = (await p).items.find((x) => x.kind === 'song')!;
  const writer = source.createSongResubmitSession!(
    item as Extract<typeof item, { kind: 'song' }>,
  );
  let finish: (
    value: Awaited<ReturnType<typeof writer.submit>>,
  ) => void = () => {};
  const submit = jest.spyOn(writer, 'submit').mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await press('다시 검수 요청');
  const next = createMockMyCards('song-resubmit' as MyCardsScenario);
  await rerender(<MyCardsWritingFlow source={next} onBack={() => {}} />);
  await tick();
  expect(submit.mock.calls[0][2].aborted).toBe(true);
  await act(async () =>
    finish({
      id: 'my-song-2',
      kind: 'song',
      category_id: 'career',
      moderation_status: 'pending',
      content: {
        track: item.kind === 'song' ? item.content.track : null!,
        recommendation: '복잡한 하루를 마치고 들었어요.',
      },
    }),
  );
  expect(screen.queryByText('다시 검수를 맡겼어요')).toBeNull();
  await fireEvent.press(screen.getByRole('tab', { name: '반려' }));
  await tick();
  await press('노래 고쳐서 다시 내기');
  expect(screen.queryByRole('button', { name: '이전 접수 확인' })).toBeNull();
  expect(screen.getByLabelText('추천 한 줄')).toHaveDisplayValue(
    '복잡한 하루를 마치고 들었어요.',
  );
});

it('keeps a wrong-card receipt uncertain and recovers only the original card ID', async () => {
  const { source } = await open();
  const p = source.load({ status: 'rejected' }, new AbortController().signal);
  await tick();
  const item = (await p).items.find((x) => x.kind === 'song')!;
  if (item.kind !== 'song') throw new Error('song fixture missing');
  const writer = source.createSongResubmitSession!(item),
    original = writer.submit;
  jest.spyOn(writer, 'submit').mockImplementationOnce(async (...args) => ({
    ...(await original(...args)),
    id: 'another-card',
  }));
  await press('다시 검수 요청');
  await tick();
  expect(screen.queryByText('다시 검수를 맡겼어요')).toBeNull();
  expect(screen.getByText('접수를 확인하지 못했어요')).toBeTruthy();
  await press('이전 접수 확인');
  await tick();
  expect(screen.getByText('다시 검수를 맡겼어요')).toBeTruthy();
});
it('returns from support with its draft and resubmits the same card', async () => {
  const { source } = await open('song-resubmit-support');
  await edit('내 경험으로 추천해요');
  await press('다시 검수 요청');
  await tick();
  expect(screen.queryByLabelText('추천 한 줄')).toBeNull();
  await fireEvent(screen.getByTestId('song-card-modal'), 'requestClose');
  expect(screen.getByLabelText('추천 한 줄')).toHaveDisplayValue(
    '내 경험으로 추천해요',
  );
  await press('다시 검수 요청');
  await tick();
  expect(screen.getByText('다시 검수를 맡겼어요')).toBeTruthy();
  await press('내 카드로 돌아가기');
  await tick();
  const p = source.load({ status: 'pending' }, new AbortController().signal);
  await tick();
  expect((await p).items.find((x) => x.id === 'my-song-2')).toMatchObject({
    revision: 2,
  });
});
it('supports a manual replacement after an empty mock search without retaining the old track ID', async () => {
  const { source } = await open('song-empty-search');
  await fireEvent.changeText(
    screen.getByLabelText('곡 이름 또는 가수 검색'),
    '새 노래',
  );
  await tick();
  await press('곡 직접 입력');
  await fireEvent.changeText(screen.getByLabelText('가수'), '새 가수');
  await edit('마음이 편해졌어요');
  await press('다시 검수 요청');
  await tick();
  expect(screen.getByText('다시 검수를 맡겼어요')).toBeTruthy();
  const p = source.load({ status: 'pending' }, new AbortController().signal);
  await tick();
  expect((await p).items.find((x) => x.id === 'my-song-2')).toMatchObject({
    id: 'my-song-2',
    revision: 2,
    content: { track: { title: '새 노래', artist: '새 가수' } },
  });
});

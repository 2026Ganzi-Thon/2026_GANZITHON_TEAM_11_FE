import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { MorningScreen } from './MorningScreen';
import { createMockMorning } from '../../mocks/morning';
import { createMockMyCards, type MyCardsScenario } from '../../mocks/myCards';
import type { TextCardSubmission } from '../cards/types';
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
const tick = (ms?: number) =>
  act(async () => {
    if (ms === undefined) await jest.runAllTimersAsync();
    else await jest.advanceTimersByTimeAsync(ms);
  });
const signal = () => new AbortController().signal;
async function settle<T>(p: Promise<T>) {
  await tick();
  return p;
}
async function setup(scenario: MyCardsScenario = 'empty') {
  jest.useFakeTimers();
  const base = createMockMorning('existing'),
    source = createMockMyCards(scenario),
    nightWriter = createMockMyCards('empty').createWritingSession();
  const actions = {
    ...base,
    writing: nightWriter,
    loadMorning: async (sig: AbortSignal) => ({
      ...(await base.loadMorning(sig)),
      writing_offer: { state: 'deferred' as const },
    }),
  };
  const load = base.loadSheep;
  const oldWrite = jest.spyOn(nightWriter.text, 'submit');
  const view = await render(
    <MorningScreen
      actions={actions}
      loadDetail={load}
      myCards={source}
      onExit={() => {}}
    />,
  );
  await tick();
  await press('2026-11-10의 양');
  await tick();
  return { base, actions, source, oldWrite, load, ...view };
}
async function write(
  kind: 'text' | 'song' = 'text',
  value = '양의 기록을 보며 남긴 말',
) {
  await press('카드 쓰기');
  await fireEvent.press(screen.getByRole('radio', { name: '학업' }));
  if (kind === 'song')
    await fireEvent.press(screen.getByRole('radio', { name: '노래 추천' }));
  await press('다음');
  if (kind === 'text')
    await fireEvent.changeText(screen.getByLabelText('짧은 글'), value);
  else {
    await fireEvent.changeText(
      screen.getByLabelText('곡 이름 또는 가수 검색'),
      '밤편지',
    );
    await tick();
    await fireEvent.press(
      screen.getByRole('radio', { name: '밤편지 · 아이유' }),
    );
    await fireEvent.changeText(screen.getByLabelText('추천 한 줄'), value);
  }
}
async function closeWriter() {
  await press('이전');
  await press('이전');
}
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});
it.each(['text', 'song'] as const)(
  'creates a new %s from a sheep, returns to the same detail and lists it pending without changing the historical night',
  async (kind) => {
    const { base, source, oldWrite } = await setup();
    const original = await settle(base.loadSheep('preview-adopted', signal()));
    const flock = await settle(base.loadFlock(signal()));
    await write(kind);
    await press('검수 요청하기');
    await tick();
    expect(screen.getByRole('button', { name: '양의 기록으로' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '이제 잘게요' })).toBeNull();
    await press('양의 기록으로');
    expect(
      screen.getByRole('header', { name: '11월 10일 밤의 양' }),
    ).toBeTruthy();
    expect(await settle(base.loadSheep('preview-adopted', signal()))).toEqual(
      original,
    );
    expect(await settle(base.loadFlock(signal()))).toEqual(flock);
    expect(oldWrite).not.toHaveBeenCalled();
    const page = await settle(source.load({ status: 'pending' }, signal()));
    expect(
      page.items.filter((item) => item.id.startsWith('my-writing-')),
    ).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      kind,
      category_id: 'study',
      moderation_status: 'pending',
    });
    await press('양떼로 돌아가기');
    await tick();
    expect(
      screen.getByRole('button', { name: '미뤄 둔 카드 쓰기' }),
    ).toBeTruthy();
    await press('내 카드 열기');
    await tick();
    expect(
      screen.getByText(
        kind === 'text' ? '양의 기록을 보며 남긴 말' : '밤편지 · 아이유',
      ),
    ).toBeTruthy();
  },
);
it('restores a draft after closing its sheep, isolates a different sheep and retires a completed session', async () => {
  const { actions, source, load, unmount } = await setup();
  await write('text', '첫 양에서 쓰던 초안');
  await closeWriter();
  await press('양떼로 돌아가기');
  await unmount();
  await render(
    <MorningScreen
      actions={actions}
      loadDetail={load}
      myCards={source}
      onExit={() => {}}
    />,
  );
  await tick();
  await press('2026-11-09의 양');
  await tick();
  await press('카드 쓰기');
  expect(
    screen.getByRole('header', { name: '누구에게 남길까요?' }),
  ).toBeTruthy();
  expect(screen.queryByDisplayValue('첫 양에서 쓰던 초안')).toBeNull();
  await press('이전');
  await press('양떼로 돌아가기');
  await press('2026-11-10의 양');
  await tick();
  await press('카드 쓰기');
  expect(screen.getByLabelText('짧은 글')).toHaveDisplayValue(
    '첫 양에서 쓰던 초안',
  );
  await press('검수 요청하기');
  await tick();
  await press('양의 기록으로');
  await press('카드 쓰기');
  expect(
    screen.getByRole('header', { name: '누구에게 남길까요?' }),
  ).toBeTruthy();
  expect(screen.queryByRole('button', { name: '이전 접수 확인' })).toBeNull();
});
it.each(['text', 'song'] as const)(
  'recovers the original %s receipt after edits and sheep close/reopen without adding another card',
  async (kind) => {
    const { source } = await setup('write-lost-response');
    await write(kind, '최초로 맡긴 내용');
    await press('검수 요청하기');
    await tick();
    expect(screen.getByText('접수를 확인하지 못했어요')).toBeTruthy();
    await fireEvent.changeText(
      screen.getByLabelText(kind === 'text' ? '짧은 글' : '추천 한 줄'),
      '응답 유실 후 고친 초안',
    );
    await closeWriter();
    await press('양떼로 돌아가기');
    await press('2026-11-10의 양');
    await tick();
    await press('카드 쓰기');
    expect(screen.getByDisplayValue('응답 유실 후 고친 초안')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: '검수 요청하기' }),
    ).toBeDisabled();
    await press('이전 접수 확인');
    await tick();
    await press('양의 기록으로');
    const page = await settle(source.load({ status: 'pending' }, signal()));
    expect(
      page.items.filter((item) => item.id.startsWith('my-writing-')),
    ).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      kind,
      content:
        kind === 'text'
          ? { text: '최초로 맡긴 내용' }
          : { recommendation: '최초로 맡긴 내용' },
    });
    await press('카드 쓰기');
    await fireEvent.press(screen.getByRole('radio', { name: '학업' }));
    await press('다음');
    expect(screen.getByLabelText('짧은 글')).toHaveDisplayValue('');
  },
);
it('cancels an in-flight text save on back and retains the original operation for safe retry', async () => {
  const { source } = await setup('write-slow');
  const writer = source.createWritingSession();
  jest.spyOn(source, 'createWritingSession').mockReturnValueOnce(writer);
  const submit = jest.spyOn(writer.text, 'submit');
  await write();
  await press('검수 요청하기');
  await press('검수 요청하기');
  expect(submit).toHaveBeenCalledTimes(1);
  await fireEvent(screen.getByTestId('text-card-modal'), 'requestClose');
  expect(submit.mock.calls[0][2].aborted).toBe(true);
  await press('이전');
  await press('카드 쓰기');
  expect(screen.getByLabelText('짧은 글')).toHaveDisplayValue(
    '양의 기록을 보며 남긴 말',
  );
  await press('이전 접수 확인');
  await tick(5000);
  await press('양의 기록으로');
  expect(
    screen.getByRole('header', { name: '11월 10일 밤의 양' }),
  ).toBeTruthy();
  expect(submit.mock.calls[1].slice(0, 2)).toEqual(
    submit.mock.calls[0].slice(0, 2),
  );
  expect(
    (await settle(source.load({ status: 'pending' }, signal()))).items.filter(
      (item) => item.id.startsWith('my-writing-'),
    ),
  ).toHaveLength(1);
});
it.each(['success', 'failure'] as const)(
  'aborts an old account writer and ignores its late %s when the collection source changes',
  async (outcome) => {
    const { actions, source, load, rerender } = await setup();
    const writer = source.createWritingSession();
    jest.spyOn(source, 'createWritingSession').mockReturnValueOnce(writer);
    let finish = () => {};
    const submit = jest.spyOn(writer.text, 'submit').mockImplementation(
      (body) =>
        new Promise<TextCardSubmission>((resolve, reject) => {
          finish = () =>
            outcome === 'failure'
              ? reject(new Error('late'))
              : resolve({
                  id: 'old-card',
                  kind: 'text',
                  category_id: body.category_id,
                  content: body.content,
                  moderation_status: 'pending',
                });
        }),
    );
    await write();
    await press('검수 요청하기');
    const next = createMockMyCards('empty');
    await rerender(
      <MorningScreen
        actions={actions}
        loadDetail={load}
        myCards={next}
        onExit={() => {}}
      />,
    );
    await tick();
    expect(submit.mock.calls[0][2].aborted).toBe(true);
    await act(async () => finish());
    expect(screen.queryByText('카드를 맡겼어요')).toBeNull();
    expect(screen.queryByLabelText('짧은 글')).toBeNull();
    await press('2026-11-10의 양');
    await tick();
    await press('카드 쓰기');
    expect(
      screen.getByRole('header', { name: '누구에게 남길까요?' }),
    ).toBeTruthy();
    expect((await settle(next.load({}, signal()))).items).toHaveLength(0);
  },
);

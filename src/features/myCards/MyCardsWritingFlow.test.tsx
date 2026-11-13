import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import Preview from '../../app/dev/my-cards';
import { MyCardsWritingFlow } from './MyCardsWritingFlow';
import { createMockMyCards, type MyCardsScenario } from '../../mocks/myCards';
import type { TextCardSubmission } from '../cards/types';
import type { SubmissionPage } from './types';

const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
const tick = () =>
  act(async () => {
    await jest.runAllTimersAsync();
  });
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});
const tab = (name: string) =>
  fireEvent.press(screen.getByRole('tab', { name }));
const signal = () => new AbortController().signal;
async function settle<T>(promise: Promise<T>) {
  await jest.runAllTimersAsync();
  return promise;
}
async function open(scenario: MyCardsScenario = 'empty') {
  jest.useFakeTimers();
  const source = createMockMyCards(scenario),
    writer = source.createWritingSession();
  const create = jest
    .spyOn(source, 'createWritingSession')
    .mockReturnValueOnce(writer);
  const onBack = jest.fn();
  const view = await render(
    <MyCardsWritingFlow source={source} onBack={onBack} />,
  );
  await tick();
  return { source, writer, create, onBack, view };
}
async function write(
  kind: 'text' | 'song' = 'text',
  text = '내 카드에서 남긴 글',
) {
  await press('카드 쓰기');
  await fireEvent.press(screen.getByRole('radio', { name: '취업' }));
  if (kind === 'song')
    await fireEvent.press(screen.getByRole('radio', { name: '노래 추천' }));
  await press('다음');
  if (kind === 'text')
    await fireEvent.changeText(screen.getByLabelText('짧은 글'), text);
  else {
    await fireEvent.changeText(
      screen.getByLabelText('곡 이름 또는 가수 검색'),
      '밤편지',
    );
    await tick();
    await fireEvent.press(
      screen.getByRole('radio', { name: '밤편지 · 아이유' }),
    );
    await fireEvent.changeText(screen.getByLabelText('추천 한 줄'), text);
  }
}
async function submit() {
  await press('검수 요청하기');
  await tick();
}
async function done() {
  await press('내 카드로');
  await tick();
}

it.each(['text', 'song'] as const)(
  'writes a %s card from the real preview route and shows it pending in both list filters',
  async (kind) => {
    jest.useFakeTimers();
    await render(<Preview />);
    await press('내 카드 목록');
    await tick();
    const write = screen.getByRole('button', { name: /카드 쓰기/ });
    expect(write).toBeEnabled();
    await fireEvent.press(write);
    await fireEvent.press(screen.getByRole('radio', { name: '학업' }));
    if (kind === 'song')
      await fireEvent.press(screen.getByRole('radio', { name: '노래 추천' }));
    await press('다음');
    if (kind === 'text')
      await fireEvent.changeText(
        screen.getByLabelText('짧은 글'),
        '새로 맡긴 첫 카드',
      );
    else {
      await fireEvent.changeText(
        screen.getByLabelText('곡 이름 또는 가수 검색'),
        '밤편지',
      );
      await tick();
      await fireEvent.press(
        screen.getByRole('radio', { name: '밤편지 · 아이유' }),
      );
      await fireEvent.changeText(
        screen.getByLabelText('추천 한 줄'),
        '새로 맡긴 노래',
      );
    }
    await press('검수 요청하기');
    await tick();
    expect(screen.getByText('카드를 맡겼어요')).toBeTruthy();
    await press('내 카드로');
    await tick();
    const label = kind === 'text' ? '새로 맡긴 첫 카드' : '밤편지 · 아이유';
    expect(screen.getAllByText(label)).toHaveLength(kind === 'text' ? 1 : 2);
    expect(screen.getByRole('tab', { name: '전체' })).toBeSelected();
    await fireEvent.press(screen.getByRole('tab', { name: '검수 중' }));
    await tick();
    expect(screen.getAllByText(label)).toHaveLength(kind === 'text' ? 1 : 2);
    expect(screen.queryByText('게시됨')).toBeNull();
  },
);

it.each(['text', 'song'] as const)(
  'keeps the cancelled %s draft and key, omits a night ID and lists the pending receipt',
  async (kind) => {
    const { source, writer } = await open();
    const send = jest.spyOn(
      kind === 'text' ? writer.text : writer.song,
      'submit',
    );
    await write(kind, '닫았다 이어 쓰는 글');
    const key = (
      kind === 'text' ? writer.text.readDraft() : writer.song.readDraft()
    ).operationKey;
    await press('이전');
    await press('이전');
    expect(screen.getByText('아직 쓴 카드가 없어요')).toBeTruthy();
    expect(send).not.toHaveBeenCalled();
    await press('카드 쓰기');
    expect(screen.getByDisplayValue('닫았다 이어 쓰는 글')).toBeTruthy();
    await submit();
    expect(send.mock.calls[0][0]).not.toHaveProperty('source_night_id');
    expect(send.mock.calls[0][1]).toBe(key);
    await done();
    const page = await settle(source.load({}, signal()));
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      kind,
      category_id: 'career',
      moderation_status: 'pending',
      yarn_count: 0,
      rejection_reason: null,
      revision: 1,
    });
    expect(screen.getAllByText('검수 중')).toHaveLength(2);
  },
);

it('starts a blank writing session after acceptance and assigns distinct keys and IDs to another identical card', async () => {
  const { source, writer, create } = await open();
  const first = jest.spyOn(writer.text, 'submit');
  await write();
  await submit();
  await done();
  const result = create.mock.results.at(-1);
  if (result?.type !== 'return') throw new Error('새 작성 세션 생성 실패');
  const second = jest.spyOn(result.value.text, 'submit');
  await press('카드 쓰기');
  expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
  expect(screen.queryByDisplayValue('내 카드에서 남긴 글')).toBeNull();
  await fireEvent.press(screen.getByRole('radio', { name: '취업' }));
  await press('다음');
  expect(screen.getByLabelText('짧은 글')).toHaveDisplayValue('');
  await fireEvent.changeText(
    screen.getByLabelText('짧은 글'),
    '내 카드에서 남긴 글',
  );
  await submit();
  await done();
  expect(first.mock.calls[0][1]).not.toBe(second.mock.calls[0][1]);
  const page = await settle(source.load({}, signal()));
  expect(page.items).toHaveLength(2);
  expect(new Set(page.items.map((item) => item.id)).size).toBe(2);
  expect(screen.getAllByText('내 카드에서 남긴 글')).toHaveLength(2);
});

it.each(['text', 'song'] as const)(
  'retries a lost %s receipt after close/reopen without creating another list record',
  async (kind) => {
    const { source, writer } = await open('write-lost-response');
    const send = jest.spyOn(
      kind === 'text' ? writer.text : writer.song,
      'submit',
    );
    await write(kind);
    await submit();
    expect(screen.getByText('접수를 확인하지 못했어요')).toBeTruthy();
    await press('이전');
    await press('이전');
    await press('카드 쓰기');
    await submit();
    expect(screen.getByText('카드를 맡겼어요')).toBeTruthy();
    expect(send.mock.calls[1].slice(0, 2)).toEqual(
      send.mock.calls[0].slice(0, 2),
    );
    await done();
    const page = await settle(source.load({ status: 'pending' }, signal()));
    expect(
      page.items.filter((item) =>
        item.kind === 'text'
          ? item.content.text === '내 카드에서 남긴 글'
          : item.content.recommendation === '내 카드에서 남긴 글',
      ),
    ).toHaveLength(1);
  },
);

it('retains a confirmed receipt when the list read fails and retries only the read after resetting the filter', async () => {
  const { source, writer } = await open('write-refresh-retry');
  const send = jest.spyOn(writer.text, 'submit'),
    load = jest.spyOn(source, 'load');
  await tab('반려');
  await tick();
  await write();
  await submit();
  await done();
  expect(screen.getByRole('tab', { name: '전체' })).toBeSelected();
  expect(
    screen.getByText('카드는 접수됐어요. 목록을 다시 불러와 주세요.'),
  ).toBeTruthy();
  expect(screen.queryByRole('button', { name: '검수 요청하기' })).toBeNull();
  await press('다시 불러오기');
  await tick();
  expect(screen.getByText('내 카드에서 남긴 글')).toBeTruthy();
  expect(
    screen.queryByText('카드는 접수됐어요. 목록을 다시 불러와 주세요.'),
  ).toBeNull();
  expect(send).toHaveBeenCalledTimes(1);
  expect(load.mock.calls.slice(-2).map(([q]) => q)).toEqual([{}, {}]);
});

it('aborts an older page request on acceptance and ignores its late page response', async () => {
  const { source } = await open('success');
  const oldPage = await settle(source.load({ cursor: '3' }, signal()));
  let finish!: (page: SubmissionPage) => void, oldSignal!: AbortSignal;
  const load = jest.spyOn(source, 'load').mockImplementationOnce((_q, sig) => {
    oldSignal = sig;
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  await press('더 불러오기');
  await write();
  await submit();
  await done();
  expect(oldSignal.aborted).toBe(true);
  await act(async () => finish(oldPage));
  expect(screen.getByText('내 카드에서 남긴 글')).toBeTruthy();
  expect(screen.queryByText('내 속도로 걸어도 괜찮아요.')).toBeNull();
  expect(load.mock.calls.at(-1)?.[0]).toEqual({});
});

it.each(['success', 'failure'] as const)(
  'cancels the previous source submission and ignores a late %s after switching sources',
  async (outcome) => {
    const { writer, view } = await open();
    let finish!: () => void, requestSignal!: AbortSignal;
    jest.spyOn(writer.text, 'submit').mockImplementation((body, _key, sig) => {
      requestSignal = sig;
      return new Promise<TextCardSubmission>((resolve, reject) => {
        finish = () =>
          outcome === 'success'
            ? resolve({
                id: 'old-receipt',
                kind: 'text',
                category_id: body.category_id,
                content: body.content,
                moderation_status: 'pending',
              })
            : reject(new Error('late'));
      });
    });
    await write();
    await press('검수 요청하기');
    const next = createMockMyCards('empty');
    await view.rerender(<MyCardsWritingFlow source={next} onBack={() => {}} />);
    await tick();
    expect(requestSignal.aborted).toBe(true);
    await act(async () => finish());
    expect(screen.queryByText('카드를 맡겼어요')).toBeNull();
    expect(screen.queryByText('접수를 확인하지 못했어요')).toBeNull();
    expect(screen.getByText('아직 쓴 카드가 없어요')).toBeTruthy();
    await press('카드 쓰기');
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
  },
);

it('stores a manually entered song with no track ID or night ID', async () => {
  const { source, writer } = await open('write-empty-search');
  const send = jest.spyOn(writer.song, 'submit');
  await press('카드 쓰기');
  await fireEvent.press(screen.getByRole('radio', { name: '취업' }));
  await fireEvent.press(screen.getByRole('radio', { name: '노래 추천' }));
  await press('다음');
  await fireEvent.changeText(
    screen.getByLabelText('곡 이름 또는 가수 검색'),
    '직접 남긴 노래',
  );
  await tick();
  await press('곡 직접 입력');
  await fireEvent.changeText(screen.getByLabelText('가수'), '예시 가수');
  await fireEvent.changeText(
    screen.getByLabelText('추천 한 줄'),
    '천천히 쉬어 가요.',
  );
  await submit();
  await done();
  expect(send.mock.calls[0][0]).toEqual({
    kind: 'song',
    category_id: 'career',
    content: {
      manual_track: { title: '직접 남긴 노래', artist: '예시 가수' },
      recommendation: '천천히 쉬어 가요.',
    },
  });
  expect(screen.getByText('직접 남긴 노래 · 예시 가수')).toBeTruthy();
  const page = await settle(source.load({}, signal()));
  expect(page.items[0]).toMatchObject({
    kind: 'song',
    moderation_status: 'pending',
    content: {
      track: { title: '직접 남긴 노래', artist: '예시 가수' },
      recommendation: '천천히 쉬어 가요.',
    },
  });
});

it('prevents duplicate pending submissions and cancels the request on preview exit', async () => {
  const { source, writer, view } = await open('write-slow');
  const send = jest.spyOn(writer.song, 'submit');
  await write('song');
  await press('검수 요청하기');
  await press('검수 요청하기');
  expect(send).toHaveBeenCalledTimes(1);
  const pendingSignal = send.mock.calls[0][2];
  await view.unmount();
  expect(pendingSignal.aborted).toBe(true);
  await tick();
  const page = await settle(source.load({ status: 'pending' }, signal()));
  expect(page.items.map((item) => item.id)).toEqual(['my-song-2', 'my-text-4']);
});

it('keeps the draft after an ordinary submission failure and retries the same request', async () => {
  const { source, writer } = await open('write-retry');
  const send = jest.spyOn(writer.text, 'submit');
  await write();
  await submit();
  expect(screen.getByText('접수를 확인하지 못했어요')).toBeTruthy();
  expect(screen.getByDisplayValue('내 카드에서 남긴 글')).toBeTruthy();
  await submit();
  await done();
  expect(send.mock.calls[1].slice(0, 2)).toEqual(
    send.mock.calls[0].slice(0, 2),
  );
  const page = await settle(source.load({ status: 'pending' }, signal()));
  expect(
    page.items.filter(
      (item) =>
        item.kind === 'text' && item.content.text === '내 카드에서 남긴 글',
    ),
  ).toHaveLength(1);
});

it('deletes the newly submitted record from the same list store after confirmation', async () => {
  const { source } = await open();
  const remove = jest.spyOn(source, 'remove');
  await write();
  await submit();
  await done();
  await press('카드 삭제: 내 카드에서 남긴 글');
  await press('취소');
  expect(remove).not.toHaveBeenCalled();
  expect(screen.getByText('내 카드에서 남긴 글')).toBeTruthy();
  await press('카드 삭제: 내 카드에서 남긴 글');
  await press('지우기');
  await tick();
  expect(screen.getByText('아직 쓴 카드가 없어요')).toBeTruthy();
  await tab('검수 중');
  await tick();
  expect(screen.getByText('검수 중인 카드가 없어요')).toBeTruthy();
  expect(await settle(source.load({}, signal()))).toEqual({
    items: [],
    next_cursor: null,
  });
});

it('blocks a different kind after a lost receipt and explains the independent writing state without a night prerequisite', async () => {
  const { source } = await open('write-lost-response');
  await write();
  await submit();
  await press('이전');
  await fireEvent.press(screen.getByRole('radio', { name: '노래 추천' }));
  await press('다음');
  await fireEvent.changeText(
    screen.getByLabelText('곡 이름 또는 가수 검색'),
    '밤편지',
  );
  await tick();
  await fireEvent.press(screen.getByRole('radio', { name: '밤편지 · 아이유' }));
  await fireEvent.changeText(
    screen.getByLabelText('추천 한 줄'),
    '다른 종류로 바꾼 글',
  );
  await submit();
  expect(screen.getByText('작성 상태를 확인해 주세요')).toBeTruthy();
  expect(screen.getByRole('button', { name: '검수 요청하기' })).toBeDisabled();
  await press('이전');
  await fireEvent.press(screen.getByRole('radio', { name: '짧은 글' }));
  await press('다음');
  expect(screen.getByDisplayValue('내 카드에서 남긴 글')).toBeTruthy();
  await submit();
  await done();
  const page = await settle(source.load({ status: 'pending' }, signal()));
  expect(
    page.items.filter(
      (item) =>
        item.kind === 'text' && item.content.text === '내 카드에서 남긴 글',
    ),
  ).toHaveLength(1);
  expect(
    page.items.some(
      (item) =>
        item.kind === 'song' &&
        item.content.recommendation === '다른 종류로 바꾼 글',
    ),
  ).toBe(false);
});

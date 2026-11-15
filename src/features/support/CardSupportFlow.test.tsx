import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { Linking, Platform } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { CardWritingScreen } from '../cards/CardWritingScreen';
import { createMockCardWriting } from '../../mocks/cardWriting';
import { createMockTextCards } from '../../mocks/textCards';
import { createMockSongCards } from '../../mocks/songCards';
import { createMockMyCards } from '../../mocks/myCards';
import { MyCardsScreen } from '../myCards/MyCardsScreen';
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
const tick = () =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(450);
  });
beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'android');
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  jest.clearAllMocks();
});
it.each(['text', 'song'] as const)(
  'preserves the %s body, choice, source and operation key through device launch, draft return and close/reopen',
  async (kind) => {
    jest.useFakeTimers();
    const text = createMockTextCards('support'),
      song = createMockSongCards('support');
    text.writeDraft({
      ...text.readDraft(),
      category_id: 'career',
      text: '오늘의 글 초안',
    });
    song.writeDraft({
      ...song.readDraft(),
      category_id: 'career',
      selection: { mode: 'manual', title: '나의 곡', artist: '나의 가수' },
      recommendation: '오늘의 추천 문장',
    });
    const actions = createMockCardWriting(text, song);
    actions.choose({ kind, category_id: 'career' });
    const original = kind === 'text' ? text.readDraft() : song.readDraft();
    const submit =
      kind === 'text' ? jest.spyOn(text, 'submit') : jest.spyOn(song, 'submit');
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const done = jest.fn();
    const props = {
      actions,
      sourceNightId: 'preview-night',
      onBack: () => {},
      onDone: done,
    };
    const view = await render(<CardWritingScreen {...props} />);
    await press('검수 요청하기');
    await tick();
    expect(screen.getByText('도움받을 곳')).toBeTruthy();
    await press('믿을 수 있는 사람에게 연락하기');
    expect(open).toHaveBeenCalledWith(
      'content://com.android.contacts/contacts',
    );
    expect(submit).toHaveBeenCalledTimes(1);
    expect(done).not.toHaveBeenCalled();
    await press('쓰던 글로 돌아가기');
    expect(kind === 'text' ? text.readDraft() : song.readDraft()).toEqual(
      original,
    );
    await view.unmount();
    await render(<CardWritingScreen {...props} />);
    expect(
      screen.getByDisplayValue(
        kind === 'text' ? '오늘의 글 초안' : '오늘의 추천 문장',
      ),
    ).toBeTruthy();
    await press('검수 요청하기');
    await tick();
    expect(submit.mock.calls[1].slice(0, 2)).toEqual(
      submit.mock.calls[0].slice(0, 2),
    );
    expect(submit.mock.calls[1][0].source_night_id).toBe('preview-night');
    expect(screen.getByText('카드를 맡겼어요')).toBeTruthy();
  },
);
it('connects rejected text to the same support screen without changing the card, draft or resubmit key', async () => {
  jest.useFakeTimers();
  const actions = createMockMyCards('resubmit-support');
  const submit = jest.spyOn(actions, 'resubmit');
  await render(
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
  await fireEvent.changeText(
    screen.getByLabelText('짧은 글 수정'),
    '고친 내 이야기',
  );
  await press('다시 검수 요청');
  await tick();
  expect(screen.getByText('도움받을 곳')).toBeTruthy();
  await press('쓰던 글로 돌아가기');
  expect(screen.getByLabelText('짧은 글 수정')).toHaveDisplayValue(
    '고친 내 이야기',
  );
  await press('다시 검수 요청');
  await tick();
  expect(submit.mock.calls[1].slice(0, 3)).toEqual(
    submit.mock.calls[0].slice(0, 3),
  );
  expect(screen.getByText('다시 검수를 맡겼어요')).toBeTruthy();
});

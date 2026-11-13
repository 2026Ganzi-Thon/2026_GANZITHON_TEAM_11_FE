import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ApiError } from '../../api/errors';
import { createMockTextCards } from '../../mocks/textCards';
import { createMockSongCards } from '../../mocks/songCards';
import { createMockCardWriting } from '../../mocks/cardWriting';
import {
  CardWritingScreen,
  type CardWritingActions,
} from './CardWritingScreen';
import type { TextCardSubmission } from './types';
import type { SongCardSubmission } from './songTypes';
const press = (label: string) =>
  fireEvent.press(screen.getByRole('button', { name: label }));
const tick = () =>
  act(async () => {
    await jest.runAllTimersAsync();
  });
function source(
  night: string,
  kind: 'text' | 'song' = 'text',
  text = '새 밤의 글',
) {
  const actions = createMockCardWriting(
    createMockTextCards('success', { sourceNightId: night }),
    createMockSongCards('success', { sourceNightId: night }),
  );
  actions.choose({ category_id: 'study', kind });
  actions.text.writeDraft({ category_id: 'study', text });
  actions.song.writeDraft({
    category_id: 'study',
    query: '',
    selection: { mode: 'manual', title: '조용한 노래', artist: '예시 가수' },
    recommendation: text,
  });
  return actions;
}
const component = (
  actions: CardWritingActions,
  night: string,
  onDone = () => {},
) => (
  <CardWritingScreen
    actions={actions}
    sourceNightId={night}
    onBack={() => {}}
    onDone={onDone}
  />
);
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (value: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});
it.each(['actions-and-night', 'actions-only', 'night-only'] as const)(
  'reads the new source draft/key before submitting after %s replacement',
  async (replacement) => {
    jest.useFakeTimers();
    const old = source('old-night', 'text', '이전 밤의 글');
    old.text.writeDraft({
      category_id: 'career',
      text: '이전 밤에서 수정한 글',
    });
    const oldKey = old.text.readDraft().operationKey;
    const nextNight =
      replacement === 'actions-only' ? 'old-night' : 'new-night';
    const next = source(nextNight, 'text', '새 소스에 저장된 글'),
      expected = next.text.readDraft();
    const submit = jest.spyOn(next.text, 'submit'),
      oldSubmit = jest.spyOn(old.text, 'submit');
    let current = old;
    const bridge: CardWritingActions = {
      get text() {
        return current.text;
      },
      get song() {
        return current.song;
      },
      readChoice: () => current.readChoice(),
      choose: (value) => current.choose(value),
    };
    const first = replacement === 'night-only' ? bridge : old;
    const view = await render(component(first, 'old-night'));
    current = next;
    await view.rerender(
      component(replacement === 'night-only' ? bridge : next, nextNight),
    );
    await press('검수 요청하기');
    await tick();
    expect(submit.mock.calls[0].slice(0, 2)).toEqual([
      {
        kind: 'text',
        category_id: 'study',
        content: { text: expected.text },
        source_night_id: nextNight,
      },
      expected.operationKey,
    ]);
    expect(submit.mock.calls[0][1]).not.toBe(oldKey);
    expect(oldSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('카드를 맡겼어요')).toBeTruthy();
  },
);
it('resets unsaved category, kind and page to the next source saved choice', async () => {
  const first = createMockCardWriting(
    createMockTextCards(),
    createMockSongCards(),
  );
  const view = await render(component(first, 'old-night'));
  await fireEvent.press(screen.getByRole('radio', { name: '취업' }));
  await fireEvent.press(screen.getByRole('radio', { name: '노래 추천' }));
  const next = createMockCardWriting(
    createMockTextCards(),
    createMockSongCards(),
  );
  await view.rerender(component(next, 'new-night'));
  expect(screen.getByRole('radio', { name: '취업' })).not.toBeChecked();
  expect(screen.getByRole('radio', { name: '짧은 글' })).toBeChecked();
  expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
});
it.each([
  ['text', 'resolve'],
  ['text', 'reject'],
  ['song', 'resolve'],
  ['song', 'reject'],
] as const)(
  'aborts the old %s submission and ignores late %s after a source change',
  async (kind, outcome) => {
    jest.useFakeTimers();
    const old = source('old-night', kind, '이전 밤의 내용');
    let finish!: () => void, fail!: () => void, signal!: () => AbortSignal;
    if (kind === 'text') {
      const pending = deferred<TextCardSubmission>(),
        submit = jest
          .spyOn(old.text, 'submit')
          .mockReturnValue(pending.promise);
      finish = () =>
        pending.resolve({
          id: 'old-card',
          kind: 'text',
          category_id: 'study',
          content: { text: '이전 밤의 내용' },
          moderation_status: 'pending',
        });
      fail = () => pending.reject(new ApiError('network'));
      signal = () => submit.mock.calls[0][2];
    } else {
      const pending = deferred<SongCardSubmission>(),
        submit = jest
          .spyOn(old.song, 'submit')
          .mockReturnValue(pending.promise);
      finish = () =>
        pending.resolve({
          id: 'old-card',
          kind: 'song',
          category_id: 'study',
          content: {
            track: {
              id: 'manual',
              title: '조용한 노래',
              artist: '예시 가수',
              cover_url: null,
              spotify_search_url: '',
            },
            recommendation: '이전 밤의 내용',
          },
          moderation_status: 'pending',
        });
      fail = () => pending.reject(new ApiError('network'));
      signal = () => submit.mock.calls[0][2];
    }
    const onDone = jest.fn(),
      view = await render(component(old, 'old-night', onDone));
    await press('검수 요청하기');
    const next = source('new-night', 'text', '새 소스에 저장된 글');
    await view.rerender(component(next, 'new-night', onDone));
    expect(signal().aborted).toBe(true);
    expect(screen.getByLabelText('짧은 글')).toHaveDisplayValue(
      '새 소스에 저장된 글',
    );
    expect(screen.queryByLabelText('추천 한 줄')).toBeNull();
    await act(async () => {
      if (outcome === 'resolve') finish();
      else fail();
    });
    expect(screen.queryByText('카드를 맡겼어요')).toBeNull();
    expect(screen.queryByText('접수를 확인하지 못했어요')).toBeNull();
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByLabelText('짧은 글')).toHaveDisplayValue(
      '새 소스에 저장된 글',
    );
    await press('검수 요청하기');
    await tick();
    expect(screen.getByText('카드를 맡겼어요')).toBeTruthy();
  },
);
it.each(['text', 'song'] as const)(
  'restores the same source %s draft and key across callback rerender and close/reopen',
  async (kind) => {
    jest.useFakeTimers();
    const actions = source('same-night', kind, '초안');
    const label = kind === 'text' ? '짧은 글' : '추천 한 줄';
    const view = await render(component(actions, 'same-night'));
    await fireEvent.changeText(
      screen.getByLabelText(label),
      '닫았다 다시 여는 초안',
    );
    const expected =
      kind === 'text' ? actions.text.readDraft() : actions.song.readDraft();
    await view.rerender(component(actions, 'same-night', jest.fn()));
    expect(screen.getByLabelText(label)).toHaveDisplayValue(
      '닫았다 다시 여는 초안',
    );
    await press('이전');
    expect(screen.getByRole('radio', { name: '학업' })).toBeChecked();
    expect(
      screen.getByRole('radio', {
        name: kind === 'text' ? '짧은 글' : '노래 추천',
      }),
    ).toBeChecked();
    await view.unmount();
    await render(component(actions, 'same-night'));
    expect(screen.getByLabelText(label)).toHaveDisplayValue(
      '닫았다 다시 여는 초안',
    );
    if (kind === 'text') {
      const submit = jest.spyOn(actions.text, 'submit');
      await press('검수 요청하기');
      await tick();
      expect(submit.mock.calls[0][1]).toBe(expected.operationKey);
    } else {
      const submit = jest.spyOn(actions.song, 'submit');
      await press('검수 요청하기');
      await tick();
      expect(submit.mock.calls[0][1]).toBe(expected.operationKey);
    }
    expect(screen.getByText('카드를 맡겼어요')).toBeTruthy();
  },
);

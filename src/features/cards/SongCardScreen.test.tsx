import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import {
  createMockSongCards,
  type SongCardScenario,
} from '../../mocks/songCards';
import { SongCardScreen } from './SongCardScreen';
import type { SongCardSubmission } from './songTypes';
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
const change = (label: string, text: string) =>
  fireEvent.changeText(screen.getByLabelText(label), text);
const tick = (ms = 700) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
async function setup(scenario: SongCardScenario = 'success') {
  jest.useFakeTimers();
  const actions = createMockSongCards(scenario);
  actions.writeDraft({ ...actions.readDraft(), category_id: 'career' });
  const submit = jest.spyOn(actions, 'submit'),
    search = jest.spyOn(actions, 'search'),
    done = jest.fn(),
    back = jest.fn();
  const view = await render(
    <SongCardScreen
      modal
      actions={actions}
      sourceNightId="preview-night"
      onBack={back}
      onDone={done}
    />,
  );
  return { actions, submit, search, done, back, ...view };
}
async function choose() {
  await change('곡 이름 또는 가수 검색', '밤편지');
  await tick();
  await fireEvent.press(screen.getByRole('radio', { name: '밤편지 · 아이유' }));
  await change('추천 한 줄', '조용히 기대기 좋은 노래');
}
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});
it('debounces search for 300ms, selects a track and sends only track_id and trimmed recommendation', async () => {
  const { search, submit, done } = await setup();
  expect(screen.getByRole('button', { name: '검수 요청하기' })).toBeDisabled();
  await change('곡 이름 또는 가수 검색', '밤');
  await tick(299);
  expect(search).not.toHaveBeenCalled();
  await change('곡 이름 또는 가수 검색', '밤편지');
  await tick(300);
  expect(search).toHaveBeenCalledTimes(1);
  expect(search.mock.calls[0][0]).toBe('밤편지');
  await tick(400);
  await fireEvent.press(screen.getByRole('radio', { name: '밤편지 · 아이유' }));
  await change('추천 한 줄', '  조용히 기대기 좋은 노래  ');
  await press('검수 요청하기');
  await tick(400);
  expect(submit.mock.calls[0][0]).toEqual({
    kind: 'song',
    category_id: 'career',
    source_night_id: 'preview-night',
    content: {
      track_id: 'preview-track-1',
      recommendation: '조용히 기대기 좋은 노래',
    },
  });
  expect(screen.getByText('카드를 맡겼어요')).toBeTruthy();
  expect(screen.queryByLabelText('추천 한 줄')).toBeNull();
  await press('이제 잘게요');
  expect(done).toHaveBeenCalledTimes(1);
});
it('supports manual title/artist only after an empty result and does not leave track_id in the payload', async () => {
  const { submit } = await setup('empty');
  await change('곡 이름 또는 가수 검색', '내 노래');
  await tick();
  await press('곡 직접 입력');
  await change('가수', '예시 가수');
  await change('추천 한 줄', '마음을 놓을 수 있어요');
  await change('곡 제목', ' ');
  expect(screen.getByRole('button', { name: '검수 요청하기' })).toBeDisabled();
  await change('곡 제목', '가'.repeat(201));
  expect(screen.getByRole('button', { name: '검수 요청하기' })).toBeDisabled();
  await change('곡 제목', '  내 노래  ');
  await press('검수 요청하기');
  await tick(400);
  expect(submit.mock.calls[0][0].content).toEqual({
    manual_track: { title: '내 노래', artist: '예시 가수' },
    recommendation: '마음을 놓을 수 있어요',
  });
  expect(screen.getByText('카드를 맡겼어요')).toBeTruthy();
});
it('clears a selected track immediately when the query changes, keeping the recommendation', async () => {
  await setup();
  await choose();
  await change('곡 이름 또는 가수 검색', '다른 노래');
  expect(screen.queryByRole('radio', { name: '밤편지 · 아이유' })).toBeNull();
  expect(screen.getByDisplayValue('조용히 기대기 좋은 노래')).toBeTruthy();
  expect(screen.getByRole('button', { name: '검수 요청하기' })).toBeDisabled();
});
it('counts trimmed Unicode text, blocks empty/over-limit input and preserves all characters', async () => {
  await setup();
  await choose();
  for (const text of [' ', '🐑'.repeat(51)]) {
    await change('추천 한 줄', text);
    expect(
      screen.getByRole('button', { name: '검수 요청하기' }),
    ).toBeDisabled();
    expect(screen.getByDisplayValue(text)).toBeTruthy();
  }
  await change('추천 한 줄', '  ' + '🐑'.repeat(50) + '  ');
  expect(screen.getByText('50 / 50')).toBeTruthy();
  expect(screen.getByRole('button', { name: '검수 요청하기' })).toBeEnabled();
});
it('distinguishes search outage from empty results and retries the same query', async () => {
  const { search } = await setup('search-retry');
  await change('곡 이름 또는 가수 검색', '밤편지');
  await tick();
  expect(
    screen.getByText('곡을 찾지 못했어요. 잠시 후 다시 시도해 주세요.'),
  ).toBeTruthy();
  expect(screen.queryByRole('button', { name: '곡 직접 입력' })).toBeNull();
  await press('검색 다시 시도');
  await tick();
  expect(screen.getByRole('radio', { name: '밤편지 · 아이유' })).toBeTruthy();
  expect(search.mock.calls.map(([q]) => q)).toEqual(['밤편지', '밤편지']);
});
it('locks submit, form edits, and modal back while the result is pending', async () => {
  const { submit, back } = await setup('slow-submit');
  await choose();
  await press('검수 요청하기');
  await press('검수 요청하기');
  await press('이전');
  await fireEvent(screen.getByTestId('song-card-modal'), 'requestClose');
  expect(submit).toHaveBeenCalledTimes(1);
  expect(back).not.toHaveBeenCalled();
  expect(screen.getByLabelText('추천 한 줄')).toHaveProp('editable', false);
  await tick(5000);
  expect(screen.getByText('카드를 맡겼어요')).toBeTruthy();
});
it('replays a lost receipt with the same key and body after closing and reopening', async () => {
  const { actions, submit, unmount } = await setup('lost-response');
  await choose();
  await press('검수 요청하기');
  await tick(400);
  expect(screen.getByText('접수를 확인하지 못했어요')).toBeTruthy();
  await unmount();
  await render(
    <SongCardScreen
      actions={actions}
      sourceNightId="preview-night"
      onBack={() => {}}
      onDone={() => {}}
    />,
  );
  expect(screen.getByDisplayValue('조용히 기대기 좋은 노래')).toBeTruthy();
  await press('검수 요청하기');
  await tick(400);
  expect(submit.mock.calls[1].slice(0, 2)).toEqual(
    submit.mock.calls[0].slice(0, 2),
  );
  expect(screen.getByText('카드를 맡겼어요')).toBeTruthy();
});
it.each(['field-error', 'safety-unavailable', 'support'] as const)(
  'keeps the selected song and draft after %s',
  async (scenario) => {
    const { actions } = await setup(scenario);
    await choose();
    await press('검수 요청하기');
    await tick(400);
    expect(screen.queryByText('카드를 맡겼어요')).toBeNull();
    if (scenario === 'support') await press('쓰던 글로 돌아가기');
    expect(screen.getByDisplayValue('조용히 기대기 좋은 노래')).toBeTruthy();
    expect(actions.readDraft().selection).toMatchObject({
      mode: 'search',
      track: { id: 'preview-track-1' },
    });
    await change('추천 한 줄', '다시 적은 추천 이유');
    await press('검수 요청하기');
    await tick(400);
    expect(screen.getByText('카드를 맡겼어요')).toBeTruthy();
  },
);
it('does not report acceptance for an expired night writing offer', async () => {
  await setup('entry-required');
  await choose();
  await press('검수 요청하기');
  await tick(400);
  expect(screen.getByText('작성할 수 있는 밤을 확인해 주세요')).toBeTruthy();
  expect(screen.queryByText('카드를 맡겼어요')).toBeNull();
  expect(screen.getByRole('button', { name: '검수 요청하기' })).toBeDisabled();
});
it.each(['id', 'category', 'status', 'track', 'recommendation'] as const)(
  'rejects a receipt with invalid %s',
  async (invalid) => {
    const { actions } = await setup();
    await choose();
    const track = actions.readDraft().selection!;
    if (track.mode !== 'search') throw new Error('expected search track');
    const receipt: SongCardSubmission = {
      id: 'card',
      kind: 'song',
      category_id: 'career',
      moderation_status: 'pending',
      content: {
        track: track.track,
        recommendation: '조용히 기대기 좋은 노래',
      },
    };
    if (invalid === 'id') receipt.id = '';
    if (invalid === 'category') receipt.category_id = 'study';
    if (invalid === 'status') receipt.moderation_status = 'approved' as never;
    if (invalid === 'track')
      receipt.content.track = { ...track.track, id: 'another' };
    if (invalid === 'recommendation')
      receipt.content.recommendation = 'another';
    jest.spyOn(actions, 'submit').mockResolvedValue(receipt);
    await press('검수 요청하기');
    expect(screen.getByText('접수를 확인하지 못했어요')).toBeTruthy();
    expect(screen.queryByText('카드를 맡겼어요')).toBeNull();
  },
);
it.each(['resolve', 'reject'] as const)(
  'aborts on unmount and ignores late %s from an adapter that ignores abort',
  async (outcome) => {
    const { actions, submit, unmount } = await setup();
    await choose();
    let resolve!: (value: SongCardSubmission) => void,
      reject!: (value: Error) => void;
    submit.mockImplementation(
      () =>
        new Promise((yes, no) => {
          resolve = yes;
          reject = no;
        }),
    );
    await press('검수 요청하기');
    await unmount();
    expect(submit.mock.calls[0][2].aborted).toBe(true);
    await act(async () =>
      outcome === 'resolve'
        ? resolve({ id: 'late' } as SongCardSubmission)
        : reject(new Error('late')),
    );
    expect(actions.readDraft().recommendation).toBe('조용히 기대기 좋은 노래');
  },
);
it('accepts a selected long-title fixture without replacing its metadata', async () => {
  await setup('long');
  await change('곡 이름 또는 가수 검색', '긴 노래');
  await tick();
  await fireEvent.press(screen.getAllByRole('radio')[0]);
  await change('추천 한 줄', '천천히 쉬어 가요');
  await press('검수 요청하기');
  await tick(400);
  expect(screen.getByText('카드를 맡겼어요')).toBeTruthy();
});
it('blocks a new edited submission after a prior response was lost but already committed', async () => {
  const { submit } = await setup('lost-response');
  await choose();
  await press('검수 요청하기');
  await tick(400);
  await change('추천 한 줄', '응답 유실 뒤 바꾼 추천');
  await press('검수 요청하기');
  await tick(400);
  expect(submit.mock.calls[1][1]).not.toBe(submit.mock.calls[0][1]);
  expect(screen.getByText('작성할 수 있는 밤을 확인해 주세요')).toBeTruthy();
  expect(screen.queryByText('카드를 맡겼어요')).toBeNull();
});
it('aborts the old submission and starts a fresh draft when its source changes', async () => {
  const { submit, rerender } = await setup('slow-submit');
  await choose();
  await press('검수 요청하기');
  const next = createMockSongCards();
  next.writeDraft({ ...next.readDraft(), category_id: 'study' });
  await rerender(
    <SongCardScreen
      modal
      actions={next}
      sourceNightId="other-night"
      onBack={() => {}}
      onDone={() => {}}
    />,
  );
  expect(submit.mock.calls[0][2].aborted).toBe(true);
  expect(screen.getByLabelText('추천 한 줄')).toHaveDisplayValue('');
  await tick(5000);
  expect(screen.queryByText('카드를 맡겼어요')).toBeNull();
});
it('drops manual fields when switching back to a searched track', async () => {
  const { search, submit } = await setup('empty');
  await change('곡 이름 또는 가수 검색', '내 노래');
  await tick();
  await press('곡 직접 입력');
  await change('가수', '가수');
  await change('추천 한 줄', '추천 이유');
  search.mockResolvedValue([
    {
      id: 'preview-track-1',
      title: '밤편지',
      artist: '아이유',
      cover_url: null,
      spotify_search_url: '',
    },
  ]);
  await press('곡 다시 찾기');
  await tick();
  await fireEvent.press(screen.getByRole('radio', { name: '밤편지 · 아이유' }));
  await press('검수 요청하기');
  await tick(400);
  expect(submit.mock.calls[0][0].content).toEqual({
    track_id: 'preview-track-1',
    recommendation: '추천 이유',
  });
  expect(screen.getByText('카드를 맡겼어요')).toBeTruthy();
});
it('blocks search queries over the API limit of 100 Unicode characters without truncating input', async () => {
  const { search } = await setup();
  await change('곡 이름 또는 가수 검색', '양'.repeat(101));
  await tick();
  expect(search).not.toHaveBeenCalled();
  expect(
    screen.getByText('검색어는 앞뒤 공백을 제외해 1~100자로 적어 주세요.'),
  ).toBeTruthy();
  expect(screen.getByLabelText('곡 이름 또는 가수 검색')).toHaveDisplayValue(
    '양'.repeat(101),
  );
  await change('곡 이름 또는 가수 검색', '  ' + '🐑'.repeat(100) + '  ');
  await tick();
  expect(search).toHaveBeenCalledTimes(1);
  expect(search.mock.calls[0][0]).toBe('🐑'.repeat(100));
});

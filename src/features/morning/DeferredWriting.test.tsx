import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { MorningScreen } from './MorningScreen';
import {
  createNightMorningDemo,
  type DemoScenario,
} from '../../mocks/nightMorningDemo';
import type { MorningActions } from './types';

const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
const tick = () =>
  act(async () => {
    await jest.runAllTimersAsync();
  });
const signal = () => new AbortController().signal;
async function settle<T>(promise: Promise<T>) {
  await jest.runAllTimersAsync();
  return promise;
}
async function setup(
  scenario: DemoScenario = 'success',
  choice: 'morning' | 'now' | null = 'morning',
) {
  jest.useFakeTimers();
  const demo = createNightMorningDemo(scenario);
  await settle(
    demo.entry.checkWorry(
      { category_id: 'study', worry_text: '시험 걱정' },
      signal(),
    ),
  );
  await settle(demo.entry.startCounting(3, signal()));
  await settle(demo.loadFeed(signal()));
  await settle(
    demo.closing.finish(
      { reason: 'leave', position: 1, furthestPosition: 1, sheepCount: 3 },
      'finish',
      signal(),
    ),
  );
  if (choice)
    await settle(demo.closing.chooseWriting(choice, 'choice', signal()));
  demo.advanceMorning();
  return demo;
}
async function home(demo: Awaited<ReturnType<typeof setup>>) {
  await render(<MorningScreen actions={demo.morning} onExit={() => {}} />);
  await tick();
  expect(
    screen.queryByRole('button', { name: '미뤄 둔 카드 쓰기' }),
  ).toBeNull();
  await press('이 양 데려오기');
  await tick();
}
async function write(kind: 'text' | 'song') {
  await press('미뤄 둔 카드 쓰기');
  await fireEvent.press(screen.getByRole('radio', { name: '취업' }));
  if (kind === 'song')
    await fireEvent.press(screen.getByRole('radio', { name: '노래 추천' }));
  await press('다음');
  if (kind === 'text')
    await fireEvent.changeText(
      screen.getByLabelText('짧은 글'),
      '아침에도 천천히 쉬어 가요.',
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
      '아침에도 쉬어 가요.',
    );
  }
}
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});
describe('deferred morning writing', () => {
  it('replays a lost receipt but refuses another kind or new key for the fulfilled morning offer', async () => {
    const demo = await setup('writing-lost-response');
    const body = {
      kind: 'text' as const,
      category_id: 'study' as const,
      content: { text: '아침에 남긴 글' },
      source_night_id: 'demo-night',
    };
    await settle(
      expect(
        demo.textCards.submit(
          { ...body, source_night_id: 'other-night' },
          'wrong-night',
          signal(),
        ),
      ).rejects.toMatchObject({ code: 'WRITING_ENTRY_REQUIRED' }),
    );
    await settle(
      expect(
        demo.textCards.submit(body, 'same-key', signal()),
      ).rejects.toMatchObject({ kind: 'network' }),
    );
    await settle(
      expect(
        demo.songCards.submit(
          {
            kind: 'song',
            category_id: 'study',
            source_night_id: 'demo-night',
            content: {
              manual_track: { title: '아침', artist: '예시 가수' },
              recommendation: '잠시 쉬어 가요.',
            },
          },
          'another-kind',
          signal(),
        ),
      ).rejects.toMatchObject({ code: 'WRITING_ENTRY_REQUIRED' }),
    );
    await settle(
      expect(
        demo.textCards.submit(body, 'new-key', signal()),
      ).rejects.toMatchObject({ code: 'WRITING_ENTRY_REQUIRED' }),
    );
    const receipt = await settle(
      demo.textCards.submit(body, 'same-key', signal()),
    );
    expect(receipt.id).toBe('preview-submitted-text-1');
    const morning = await settle(
      demo.morning.loadMorning(signal(), 'demo-night'),
    );
    expect(morning.writing_offer?.state).toBe('fulfilled');
    expect(morning.candidate_cards.map((c) => c.card.id)).toEqual([
      'preview-card-1',
    ]);
  });
  it.each(['text', 'song'] as const)(
    'restores the %s draft on cancel, submits for the banner night and returns to home',
    async (kind) => {
      const demo = await setup();
      const submit = jest.spyOn(
        kind === 'text' ? demo.textCards : demo.songCards,
        'submit',
      );
      const load = jest.spyOn(demo.morning, 'loadMorning');
      await home(demo);
      await write(kind);
      const draft =
        kind === 'text'
          ? demo.textCards.readDraft()
          : demo.songCards.readDraft();
      await press('이전');
      await press('이전');
      expect(screen.getByText('어젯밤 미뤄 둔 카드가 있어요')).toBeTruthy();
      expect(submit).not.toHaveBeenCalled();
      await press('미뤄 둔 카드 쓰기');
      expect(
        screen.getByDisplayValue(
          kind === 'text'
            ? '아침에도 천천히 쉬어 가요.'
            : '아침에도 쉬어 가요.',
        ),
      ).toBeTruthy();
      await press('검수 요청하기');
      await tick();
      expect(submit).toHaveBeenCalledWith(
        expect.objectContaining({
          source_night_id: 'demo-night',
          category_id: 'career',
          kind,
        }),
        draft.operationKey,
        expect.any(AbortSignal),
      );
      expect(screen.getByText('카드를 맡겼어요')).toBeTruthy();
      expect(screen.queryByRole('button', { name: '이제 잘게요' })).toBeNull();
      await press('아침 홈으로');
      await tick();
      expect(screen.getByText('나의 양떼')).toBeTruthy();
      expect(
        screen.queryByRole('button', { name: '미뤄 둔 카드 쓰기' }),
      ).toBeNull();
      expect(load).toHaveBeenLastCalledWith(
        expect.any(AbortSignal),
        'demo-night',
      );
      const morning = await settle(demo.morning.loadMorning(signal()));
      expect(morning.writing_offer?.state).toBe('fulfilled');
      expect(morning.candidate_cards.map((c) => c.card.id)).toEqual([
        'preview-card-1',
      ]);
    },
  );
  it.each(['text', 'song'] as const)(
    'keeps the %s draft and idempotency key after a lost receipt, including close/reopen',
    async (kind) => {
      const demo = await setup('writing-lost-response');
      const submit = jest.spyOn(
        kind === 'text' ? demo.textCards : demo.songCards,
        'submit',
      );
      await home(demo);
      await write(kind);
      await press('검수 요청하기');
      await tick();
      expect(screen.getByText('접수를 확인하지 못했어요')).toBeTruthy();
      await press('이전');
      await press('이전');
      await press('미뤄 둔 카드 쓰기');
      await press('검수 요청하기');
      await tick();
      expect(screen.getByText('카드를 맡겼어요')).toBeTruthy();
      expect(submit.mock.calls[1].slice(0, 2)).toEqual(
        submit.mock.calls[0].slice(0, 2),
      );
      await press('아침 홈으로');
      await tick();
      expect(
        screen.queryByRole('button', { name: '미뤄 둔 카드 쓰기' }),
      ).toBeNull();
    },
  );
  it.each([null, 'now'] as const)(
    'makes an unanswered or unfinished night offer (%s) available the next morning',
    async (choice) => {
      const demo = await setup('success', choice);
      await home(demo);
      expect(
        screen.getByRole('button', { name: '미뤄 둔 카드 쓰기' }),
      ).toBeTruthy();
    },
  );
  it('keeps an already fulfilled night offer hidden in morning home', async () => {
    const demo = await setup();
    await settle(
      demo.textCards.submit(
        {
          kind: 'text',
          category_id: 'study',
          content: { text: '먼저 접수된 글' },
          source_night_id: demo.nightId,
        },
        'accepted',
        signal(),
      ),
    );
    await home(demo);
    expect(
      screen.queryByRole('button', { name: '미뤄 둔 카드 쓰기' }),
    ).toBeNull();
  });
  it('cancels a scoped refresh on exit and ignores its late response', async () => {
    const demo = await setup();
    const load = jest.spyOn(demo.morning, 'loadMorning');
    await home(demo);
    const morning = await settle(demo.morning.loadMorning(signal()));
    let finish!: () => void, requestSignal!: AbortSignal;
    load.mockImplementation((sig) => {
      requestSignal = sig;
      return new Promise((resolve) => {
        finish = () =>
          resolve({ ...morning, writing_offer: { state: 'fulfilled' } });
      });
    });
    await write('text');
    await press('검수 요청하기');
    await tick();
    await press('아침 홈으로');
    expect(requestSignal.aborted).toBe(false);
    await screen.unmount();
    expect(requestSignal.aborted).toBe(true);
    await act(async () => finish());
  });
  it('retries only the scoped read after receipt confirmation and a failed morning refresh', async () => {
    const demo = await setup('writing-refresh-retry');
    const submit = jest.spyOn(demo.textCards, 'submit');
    const load = jest.spyOn(demo.morning, 'loadMorning');
    await home(demo);
    await write('text');
    await press('검수 요청하기');
    await tick();
    await press('아침 홈으로');
    await tick();
    expect(
      screen.getByText('카드는 접수됐어요. 작성 상태를 다시 확인해 주세요.'),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: '미뤄 둔 카드 쓰기' }),
    ).toBeNull();
    await press('작성 상태 다시 확인');
    await tick();
    expect(
      screen.queryByRole('button', { name: '작성 상태 다시 확인' }),
    ).toBeNull();
    expect(load).toHaveBeenLastCalledWith(
      expect.any(AbortSignal),
      'demo-night',
    );
    expect(submit).toHaveBeenCalledTimes(1);
  });
  it('rejects a refresh result for a different night and keeps resubmission blocked', async () => {
    const demo = await setup();
    const load = jest.spyOn(demo.morning, 'loadMorning');
    await home(demo);
    const value = await settle(demo.morning.loadMorning(signal()));
    load.mockResolvedValue({
      ...value,
      night: { id: 'other-night', night_date: '2026-11-13' },
    });
    await write('text');
    await press('검수 요청하기');
    await tick();
    await press('아침 홈으로');
    await tick();
    expect(
      screen.getByRole('button', { name: '작성 상태 다시 확인' }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: '미뤄 둔 카드 쓰기' }),
    ).toBeNull();
    expect(load).toHaveBeenLastCalledWith(
      expect.any(AbortSignal),
      'demo-night',
    );
  });
  it.each(['success', 'failure'] as const)(
    'aborts a pending writer on source replacement and ignores late %s',
    async (outcome) => {
      const old = await setup(),
        next = await setup();
      const nextMorning = await settle(next.morning.loadMorning(signal()));
      const actions: MorningActions = {
        ...next.morning,
        loadMorning: async () => ({
          ...nextMorning,
          night: { id: 'other-night', night_date: '2026-11-13' },
          adoption: {
            id: 'other-sheep',
            night_id: 'other-night',
            night_date: '2026-11-13',
            card_id: 'preview-card-1',
            color_key: 'study',
          },
        }),
      };
      let finish!: () => void, requestSignal!: AbortSignal;
      jest
        .spyOn(old.textCards, 'submit')
        .mockImplementation((body, _key, sig) => {
          requestSignal = sig;
          return new Promise((resolve, reject) => {
            finish = () =>
              outcome === 'success'
                ? resolve({
                    id: 'late',
                    kind: 'text',
                    category_id: body.category_id,
                    content: body.content,
                    moderation_status: 'pending',
                  })
                : reject(new Error('late failure'));
          });
        });
      const view = await render(
        <MorningScreen actions={old.morning} onExit={() => {}} />,
      );
      await tick();
      await press('이 양 데려오기');
      await tick();
      await write('text');
      await press('검수 요청하기');
      await view.rerender(
        <MorningScreen actions={actions} onExit={() => {}} />,
      );
      await tick();
      expect(requestSignal.aborted).toBe(true);
      await act(async () => finish());
      expect(screen.queryByText('카드를 맡겼어요')).toBeNull();
      await press('미뤄 둔 카드 쓰기');
      expect(
        screen.queryByDisplayValue('아침에도 천천히 쉬어 가요.'),
      ).toBeNull();
      expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
    },
  );
});

import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ClosingScreen } from './ClosingScreen';
import type { ClosingActions, ClosingRequest, ClosingResult } from './types';
const input: ClosingRequest = {
  reason: 'leave',
  position: 2,
  furthestPosition: 3,
  sheepCount: 6,
};
const result: ClosingResult = {
  summary: { counted: 3, entrusted_count: 0, fluff_count: 0 },
  closing_card: {
    id: 'warm',
    kind: 'text',
    tone: 'warm',
    category_id: null,
    author_type: 'seed',
    author_label: '먼저 지나간 양',
    available: true,
    content: { text: '여기까지도 충분해.' },
    viewer: { yarn_sent: false, fluff_saved: false, song_saved: false },
  },
  writing_offer: { state: 'offered' },
};
function actions(): ClosingActions {
  return {
    finish: jest.fn<ClosingActions['finish']>().mockResolvedValue(result),
    markViewed: jest
      .fn<ClosingActions['markViewed']>()
      .mockResolvedValue(undefined),
    chooseWriting: jest
      .fn<ClosingActions['chooseWriting']>()
      .mockResolvedValue(undefined),
  };
}
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
afterEach(() => {
  jest.restoreAllMocks();
});
describe('night closing flow', () => {
  it('shows an early closing card before acknowledging it, then summary and writing choices', async () => {
    const api = actions();
    await render(
      <ClosingScreen input={input} actions={api} onExit={() => {}} />,
    );
    expect(screen.getByText('여기까지도 충분해.')).toBeTruthy();
    expect(api.markViewed).not.toHaveBeenCalled();
    await press('다음');
    expect(api.markViewed).toHaveBeenCalledWith(
      'warm',
      expect.any(String),
      expect.any(AbortSignal),
    );
    expect(screen.getByText('오늘은 3마리까지 셌어요')).toBeTruthy();
    await press('다음');
    expect(screen.getByText('누군가에게\n한마디 남겨 볼래요?')).toBeTruthy();
    await press('아침에 쓸게요');
    expect(api.chooseWriting).toHaveBeenCalledWith(
      'morning',
      expect.any(String),
      expect.any(AbortSignal),
    );
    expect(screen.getByText('편안한 밤 보내요')).toBeTruthy();
  });
  it('does not repeat the last card or acknowledge a new one after completion', async () => {
    const api = actions();
    await render(
      <ClosingScreen
        input={{
          ...input,
          reason: 'completed',
          position: 6,
          furthestPosition: 6,
        }}
        actions={api}
        onExit={() => {}}
      />,
    );
    expect(screen.queryByText('여기까지도 충분해.')).toBeNull();
    expect(api.markViewed).not.toHaveBeenCalled();
    expect(screen.getByText('3마리 다 셌어요')).toBeTruthy(); // display the returned summary
  });
  it('retries finish with the same key and snapshot, without duplicate submissions', async () => {
    const api = actions();
    let resolve!: (result: ClosingResult) => void;
    const finish = jest
      .fn<ClosingActions['finish']>()
      .mockRejectedValueOnce(new Error('private'))
      .mockImplementation(
        () =>
          new Promise((r) => {
            resolve = r;
          }),
      );
    api.finish = finish;
    await render(
      <ClosingScreen input={input} actions={api} onExit={() => {}} />,
    );
    expect(screen.queryByText('private')).toBeNull();
    await press('다시 시도');
    expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull();
    expect(finish).toHaveBeenCalledTimes(2);
    expect(finish.mock.calls[0].slice(0, 2)).toEqual(
      finish.mock.calls[1].slice(0, 2),
    );
    await act(async () => resolve(result));
    expect(screen.getByText('여기까지도 충분해.')).toBeTruthy();
  });
  it('retries only the failed view acknowledgment', async () => {
    const api = actions();
    api.markViewed = jest
      .fn<ClosingActions['markViewed']>()
      .mockRejectedValueOnce(new Error())
      .mockResolvedValue(undefined);
    await render(
      <ClosingScreen input={input} actions={api} onExit={() => {}} />,
    );
    await press('다음');
    await press('다시 시도');
    expect(api.finish).toHaveBeenCalledTimes(1);
    expect(api.markViewed).toHaveBeenCalledTimes(2);
    expect(screen.getByText('오늘은 3마리까지 셌어요')).toBeTruthy();
  });
  it('retries writing choice with the same key and clearly marks the unwired editor', async () => {
    const api = actions();
    const choose = jest
      .fn<ClosingActions['chooseWriting']>()
      .mockRejectedValueOnce(new Error())
      .mockResolvedValue(undefined);
    api.chooseWriting = choose;
    await render(
      <ClosingScreen
        input={{ ...input, reason: 'completed' }}
        actions={api}
        onExit={() => {}}
      />,
    );
    await press('다음');
    await press('지금 쓸래요');
    await press('다시 시도');
    expect(choose.mock.calls[0].slice(0, 2)).toEqual(
      choose.mock.calls[1].slice(0, 2),
    );
    expect(screen.getByText('카드 작성 화면은 준비 중이에요')).toBeTruthy();
    await press('아침에 쓸게요');
    expect(choose.mock.calls[2][0]).toBe('morning');
    expect(api.finish).toHaveBeenCalledTimes(1);
  });
  it('does not expose or acknowledge an unavailable closing card', async () => {
    const api = actions();
    api.finish = jest.fn<ClosingActions['finish']>().mockResolvedValue({
      ...result,
      closing_card: { ...result.closing_card!, available: false },
    });
    await render(
      <ClosingScreen input={input} actions={api} onExit={() => {}} />,
    );
    expect(screen.queryByText('여기까지도 충분해.')).toBeNull();
    expect(screen.getByText('지금은 마무리 카드를 볼 수 없어요')).toBeTruthy();
    await press('다음');
    expect(api.markViewed).not.toHaveBeenCalled();
    expect(screen.getByText('오늘은 3마리까지 셌어요')).toBeTruthy();
  });
  it('skips a writing offer already fulfilled', async () => {
    const api = actions();
    api.finish = jest
      .fn<ClosingActions['finish']>()
      .mockResolvedValue({ ...result, writing_offer: { state: 'fulfilled' } });
    await render(
      <ClosingScreen
        input={{ ...input, reason: 'completed' }}
        actions={api}
        onExit={() => {}}
      />,
    );
    await press('다음');
    expect(screen.queryByText('누군가에게\n한마디 남겨 볼래요?')).toBeNull();
    expect(screen.getByText('편안한 밤 보내요')).toBeTruthy();
    expect(api.chooseWriting).not.toHaveBeenCalled();
  });
  it('aborts on exit and ignores a late successful finish', async () => {
    const api = actions();
    let resolve!: (result: ClosingResult) => void;
    const finish = jest.fn<ClosingActions['finish']>().mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    api.finish = finish;
    const onExit = jest.fn();
    await render(<ClosingScreen input={input} actions={api} onExit={onExit} />);
    await press('미리보기 나가기');
    expect(finish.mock.calls[0][2].aborted).toBe(true);
    await act(async () => resolve(result));
    expect(screen.queryByText('여기까지도 충분해.')).toBeNull();
    expect(onExit).toHaveBeenCalledTimes(1);
  });
  it('blocks repeated card confirmation while pending and aborts that operation on unmount', async () => {
    const api = actions();
    let resolve!: () => void;
    const mark = jest.fn<ClosingActions['markViewed']>().mockImplementation(
      () =>
        new Promise<void>((r) => {
          resolve = r;
        }),
    );
    api.markViewed = mark;
    await render(
      <ClosingScreen input={input} actions={api} onExit={() => {}} />,
    );
    const next = screen.getByRole('button', { name: '다음' });
    await fireEvent.press(next);
    expect(screen.queryByRole('button', { name: '다음' })).toBeNull();
    expect(mark).toHaveBeenCalledTimes(1);
    await screen.unmount();
    expect(mark.mock.calls[0][2].aborted).toBe(true);
    await act(async () => resolve());
    expect(api.finish).toHaveBeenCalledTimes(1);
  });
  it('aborts a pending writing choice on exit without advancing to the editor', async () => {
    const api = actions();
    let resolve!: () => void;
    const choose = jest
      .fn<ClosingActions['chooseWriting']>()
      .mockImplementation(
        () =>
          new Promise<void>((r) => {
            resolve = r;
          }),
      );
    api.chooseWriting = choose;
    await render(
      <ClosingScreen
        input={{ ...input, reason: 'completed' }}
        actions={api}
        onExit={() => {}}
      />,
    );
    await press('다음');
    await press('지금 쓸래요');
    expect(screen.queryByRole('button', { name: '아침에 쓸게요' })).toBeNull();
    await press('미리보기 나가기');
    expect(choose.mock.calls[0][2].aborted).toBe(true);
    await act(async () => resolve());
    expect(screen.queryByText('카드 작성 화면은 준비 중이에요')).toBeNull();
  });
});

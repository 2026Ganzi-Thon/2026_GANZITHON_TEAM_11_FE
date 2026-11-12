import { describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ApiError } from '../../api/errors';
import { SheepDetailScreen } from './SheepDetailScreen';
import type { SheepDetail, SheepDetailLoad } from './types';

const detail: SheepDetail = {
  sheep: {
    id: 's1',
    card_id: 'c1',
    night_id: 'n1',
    night_date: '2026-11-07',
    color_key: 'career',
  },
  card: {
    id: 'c1',
    kind: 'text',
    available: true,
    content: { text: '카드 내용' },
    tone: 'empathy',
    category_id: 'career',
    author_type: 'seed',
    author_label: '먼저 지나간 양',
    viewer: { yarn_sent: false, fluff_saved: false, song_saved: false },
  },
  position: 4,
  sheep_count: 15,
  night: {
    night_date: '2026-11-07',
    category_id: 'career',
    worry_text: '면접이 걱정돼요.',
    reflection: { answer: 'smaller', message: '조금 작아졌구나.' },
  },
};
const press = (label: string) =>
  fireEvent.press(screen.getByRole('button', { name: label }));
describe('sheep detail read-only flow', () => {
  it('loads by sheep ID and shows card, night, position and the existing reflection', async () => {
    const load = jest.fn<SheepDetailLoad>().mockResolvedValue(detail);
    await render(
      <SheepDetailScreen sheepId="s1" load={load} onBack={() => {}} />,
    );
    expect(load).toHaveBeenCalledWith('s1', expect.any(AbortSignal));
    for (const text of [
      '11월 7일 밤의 양',
      '카드 내용',
      '면접이 걱정돼요.',
      '작아졌어요',
      '조금 작아졌구나.',
    ])
      expect(screen.getByText(text)).toBeTruthy();
    expect(screen.getByText(/15마리 중 4번째/)).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: /삭제|저장|꾸미기/ }),
    ).toBeNull();
    expect(
      screen.getByRole('button', { name: '카드 쓰기 · 준비 중' }),
    ).toBeDisabled();
  });
  it.each([false, true])(
    'hides unavailable content and attribution while preserving the sheep and worry (null=%s)',
    async (nullContent) => {
      const value = {
        ...detail,
        card: {
          ...detail.card,
          available: nullContent,
          content: nullContent ? null : detail.card.content,
        },
      } as SheepDetail;
      await render(
        <SheepDetailScreen
          sheepId="s1"
          load={async () => value}
          onBack={() => {}}
        />,
      );
      expect(screen.getByText('지금은 이 카드를 볼 수 없어요')).toBeTruthy();
      expect(screen.queryByText('카드 내용')).toBeNull();
      expect(screen.queryByText(/먼저 지나간 양/)).toBeNull();
      expect(screen.getByText('면접이 걱정돼요.')).toBeTruthy();
    },
  );
  it.each([null, '   '])(
    'does not expose a residual reflection if the worry is missing (%s)',
    async (worry) => {
      await render(
        <SheepDetailScreen
          sheepId="s1"
          load={async () => ({
            ...detail,
            night: { ...detail.night, worry_text: worry },
          })}
          onBack={() => {}}
        />,
      );
      expect(screen.getByText('남아 있는 고민 기록이 없어요.')).toBeTruthy();
      expect(screen.queryByText('작아졌어요')).toBeNull();
      expect(screen.queryByText('조금 작아졌구나.')).toBeNull();
      expect(screen.getByText('카드 내용')).toBeTruthy();
    },
  );
  it('hides worry and reflection for a no-worry night even if supplied', async () => {
    await render(
      <SheepDetailScreen
        sheepId="s1"
        load={async () => ({
          ...detail,
          night: { ...detail.night, category_id: 'none' },
        })}
        onBack={() => {}}
      />,
    );
    expect(screen.getByText('고민 없이 쉬어 간 밤이에요.')).toBeTruthy();
    expect(screen.queryByText('면접이 걱정돼요.')).toBeNull();
    expect(screen.queryByText('조금 작아졌구나.')).toBeNull();
  });
  it('does not invent a position for a closing card or a missing count', async () => {
    for (const fields of [
      { position: null, sheep_count: 15 },
      { position: 4, sheep_count: null },
    ]) {
      await render(
        <SheepDetailScreen
          sheepId="s1"
          load={async () => ({ ...detail, ...fields })}
          onBack={() => {}}
        />,
      );
      expect(screen.queryByText(/번째/)).toBeNull();
      expect(screen.queryByText(/null/)).toBeNull();
      await screen.unmount();
    }
  });
  it('shows song metadata and hides generated recommendation and author', async () => {
    const value: SheepDetail = {
      ...detail,
      card: {
        ...detail.card,
        kind: 'song',
        author_type: 'ai',
        content: {
          track: {
            id: 't',
            title: '곡 제목',
            artist: '가수',
            cover_url: null,
            spotify_search_url: '',
          },
          recommendation: '숨길 추천',
        },
      },
    };
    await render(
      <SheepDetailScreen
        sheepId="s1"
        load={async () => value}
        onBack={() => {}}
      />,
    );
    expect(screen.getByText('곡 제목')).toBeTruthy();
    expect(screen.getByText('가수')).toBeTruthy();
    expect(screen.queryByText('숨길 추천')).toBeNull();
    expect(screen.queryByText(/먼저 지나간 양/)).toBeNull();
    expect(screen.queryByRole('button', { name: /재생/ })).toBeNull();
  });
  it('retries a failed read for the same ID and blocks repeated retries while loading', async () => {
    let resolve!: (value: SheepDetail) => void;
    const load = jest
      .fn<SheepDetailLoad>()
      .mockRejectedValueOnce(new Error('private detail'))
      .mockImplementation(
        () =>
          new Promise((r) => {
            resolve = r;
          }),
      );
    await render(
      <SheepDetailScreen sheepId="s1" load={load} onBack={() => {}} />,
    );
    expect(screen.queryByText('private detail')).toBeNull();
    await press('다시 불러오기');
    expect(screen.queryByRole('button', { name: '다시 불러오기' })).toBeNull();
    expect(load.mock.calls.map((c) => c[0])).toEqual(['s1', 's1']);
    await act(async () => resolve(detail));
    expect(screen.getByText('카드 내용')).toBeTruthy();
  });
  it.each([403, 404])(
    'shows unavailable access for HTTP %s with a working way back',
    async (status) => {
      const onBack = jest.fn();
      await render(
        <SheepDetailScreen
          sheepId="s1"
          load={async () => {
            throw new ApiError('http', { status });
          }}
          onBack={onBack}
        />,
      );
      expect(screen.getByText('이 양의 기록을 볼 수 없어요')).toBeTruthy();
      expect(
        screen.queryByRole('button', { name: '다시 불러오기' }),
      ).toBeNull();
      await press('양떼로 돌아가기');
      expect(onBack).toHaveBeenCalledTimes(1);
    },
  );
  it('rejects a response belonging to a different sheep without showing its content', async () => {
    await render(
      <SheepDetailScreen
        sheepId="s2"
        load={async () => detail}
        onBack={() => {}}
      />,
    );
    expect(screen.queryByText('카드 내용')).toBeNull();
    expect(screen.getByText('기록을 불러오지 못했어요')).toBeTruthy();
  });
  it('hides the previous record immediately on ID change and ignores a late response', async () => {
    let resolveFirst!: (value: SheepDetail) => void;
    let resolveSecond!: (value: SheepDetail) => void;
    const load = jest
      .fn<SheepDetailLoad>()
      .mockImplementationOnce(
        () =>
          new Promise((r) => {
            resolveFirst = r;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((r) => {
            resolveSecond = r;
          }),
      );
    await render(
      <SheepDetailScreen sheepId="s1" load={load} onBack={() => {}} />,
    );
    await screen.rerender(
      <SheepDetailScreen sheepId="s2" load={load} onBack={() => {}} />,
    );
    expect(load.mock.calls[0][1].aborted).toBe(true);
    await act(async () => resolveFirst(detail));
    expect(screen.queryByText('카드 내용')).toBeNull();
    const second: SheepDetail = {
      ...detail,
      sheep: { ...detail.sheep, id: 's2' },
      card: {
        ...detail.card,
        kind: 'text',
        content: { text: '다른 양의 카드' },
      },
    };
    await act(async () => resolveSecond(second));
    expect(screen.getByText('다른 양의 카드')).toBeTruthy();
    await screen.rerender(
      <SheepDetailScreen
        sheepId="s3"
        load={() => new Promise(() => {})}
        onBack={() => {}}
      />,
    );
    expect(screen.queryByText('다른 양의 카드')).toBeNull();
  });
  it('aborts on back and on unmount, ignoring a late successful response', async () => {
    let resolve!: (value: SheepDetail) => void;
    const load = jest.fn<SheepDetailLoad>().mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const back = jest.fn();
    await render(<SheepDetailScreen sheepId="s1" load={load} onBack={back} />);
    await press('양떼로 돌아가기');
    expect(load.mock.calls[0][1].aborted).toBe(true);
    await act(async () => resolve(detail));
    expect(screen.queryByText('카드 내용')).toBeNull();
    expect(back).toHaveBeenCalledTimes(1);
    await screen.unmount();
  });
});

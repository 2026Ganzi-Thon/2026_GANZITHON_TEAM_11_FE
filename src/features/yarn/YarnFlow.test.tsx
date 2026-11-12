import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { FeedScreen } from '../night/feed/FeedScreen';
import { createYarnPreview } from '../../mocks/yarn';
import type { YarnActions } from './types';
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
const tick = (ms = 400) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
async function open(
  demo = createYarnPreview(),
  patch: Partial<YarnActions> = {},
) {
  jest.useFakeTimers();
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
  const api = { ...demo.yarn, ...patch };
  const view = await render(
    <FeedScreen load={demo.load} yarn={api} onBack={() => {}} />,
  );
  await tick(800);
  return { demo, api, view };
}
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});
describe('yarn reactions in a moving feed', () => {
  it('enables the yarn action while leaving fluff explicitly unavailable', async () => {
    await open();
    expect(screen.getByRole('button', { name: /털실 보내기/ })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: '솜털 보내기 · 준비 중' }),
    ).toBeDisabled();
  });
  it('keeps delayed send and removal across immediate next/previous movement', async () => {
    const { view } = await open(createYarnPreview('slow'));
    await press('털실 보내기');
    expect(screen.getByRole('button', { name: '털실 보내기 취소' })).toBeBusy();
    await press('다음 양');
    expect(screen.getByText('2 / 6')).toBeTruthy();
    await press('이전 양');
    await tick(5000);
    expect(
      screen.getByRole('button', { name: '털실 보내기 취소' }),
    ).toBeSelected();
    await press('털실 보내기 취소');
    await press('다음 양');
    await press('이전 양');
    await tick(5000);
    expect(
      screen.getByRole('button', { name: '털실 보내기' }),
    ).not.toBeSelected();
    expect(screen.getByText('털실을 거뒀어요')).toBeTruthy();
    await view.unmount();
  });
  it('coalesces rapid send/cancel/send and never sends a duplicate final target', async () => {
    const demo = createYarnPreview('slow');
    const set = jest.spyOn(demo.yarn, 'set');
    await open(demo);
    await press('털실 보내기');
    await press('털실 보내기 취소');
    await press('털실 보내기');
    expect(set).toHaveBeenCalledTimes(1);
    await tick(5000);
    expect(
      screen.getByRole('button', { name: '털실 보내기 취소' }),
    ).toBeSelected();
  });
  it('shows an offscreen failure only on its own card and retries the same intent', async () => {
    await open(createYarnPreview('retry'));
    await press('털실 보내기');
    await press('다음 양');
    await tick();
    expect(screen.queryByText('털실 변경을 확인하지 못했어요')).toBeNull();
    await press('이전 양');
    expect(screen.getByText('털실 변경을 확인하지 못했어요')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: '털실 보내기' }),
    ).not.toBeSelected();
    await press('털실 다시 시도');
    await tick();
    expect(
      screen.getByRole('button', { name: '털실 보내기 취소' }),
    ).toBeSelected();
  });
  it('retains confirmed true after a removal failure and retries false', async () => {
    await open(createYarnPreview('remove-retry'));
    await press('털실 보내기 취소');
    await tick();
    expect(
      screen.getByRole('button', { name: '털실 보내기 취소' }),
    ).toBeSelected();
    await press('털실 다시 시도');
    await tick();
    expect(
      screen.getByRole('button', { name: '털실 보내기' }),
    ).not.toBeSelected();
  });
  it('removes unavailable content and controls after CARD_UNAVAILABLE', async () => {
    await open(createYarnPreview('unavailable'));
    await press('털실 보내기');
    await tick();
    expect(screen.getByText('지금은 볼 수 없는 카드예요')).toBeTruthy();
    expect(screen.queryByText(/나도 결과 기다리는/)).toBeNull();
    expect(screen.queryByRole('button', { name: /털실 보내기/ })).toBeNull();
    await press('다음 양');
    await press('이전 양');
    expect(screen.queryByRole('button', { name: /털실 보내기/ })).toBeNull();
  });
  it('cancels on explicit back and ignores a late success', async () => {
    let resolve!: (r: { card_id: string; sent: boolean }) => void;
    let signal: AbortSignal | undefined;
    const set: YarnActions['set'] = (id, sent, s) => {
      signal = s;
      return new Promise((r) => {
        resolve = r;
      });
    };
    await open(createYarnPreview(), { set });
    await press('털실 보내기');
    await press('미리보기 나가기');
    expect(signal?.aborted).toBe(true);
    await act(async () => resolve({ card_id: 'preview-card-1', sent: true }));
    expect(screen.queryByText('털실을 보냈어요')).toBeNull();
    expect(
      screen.getByRole('button', { name: '털실 보내기' }),
    ).not.toBeSelected();
  });
  it('cancels a queued change when the feed is finished', async () => {
    const demo = createYarnPreview('slow');
    const set = jest.spyOn(demo.yarn, 'set');
    await open(demo);
    for (let i = 0; i < 5; i++) await press('다음 양');
    await press('털실 보내기');
    await press('털실 보내기 취소');
    await press('미리보기 마치기');
    expect(set.mock.calls[0][2].aborted).toBe(true);
    await tick(10000);
    expect(set).toHaveBeenCalledTimes(1);
    expect(screen.getByText('피드 미리보기를 마쳤어요')).toBeTruthy();
  });
  it('aborts the previous scope even if a new feed reuses the same card id', async () => {
    const a = createYarnPreview('slow');
    const set = jest.spyOn(a.yarn, 'set');
    const { view } = await open(a);
    await press('털실 보내기');
    const b = createYarnPreview();
    await view.rerender(
      <FeedScreen load={b.load} yarn={b.yarn} onBack={() => {}} />,
    );
    await tick(800);
    expect(set.mock.calls[0][2].aborted).toBe(true);
    await tick(5000);
    expect(
      screen.getByRole('button', { name: '털실 보내기' }),
    ).not.toBeSelected();
  });
  it('allows reactions on each available text/song/seed/mongchi/AI variant', async () => {
    await open();
    for (let i = 0; i < 6; i++) {
      await press('털실 보내기');
      await tick();
      expect(
        screen.getByRole('button', { name: '털실 보내기 취소' }),
      ).toBeSelected();
      if (i === 2) expect(screen.getByText('털실을 보냈어요')).toBeTruthy();
      if (i === 3)
        expect(screen.getByText('작성자에게 털실을 보냈어요')).toBeTruthy();
      if (i < 5) await press('다음 양');
    }
  });
});

import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { MorningScreen } from '../morning/MorningScreen';
import { createSettingsMorning } from '../../mocks/settingsMorning';
const tick = () =>
  act(async () => {
    await jest.runAllTimersAsync();
  });
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
afterEach(() => {
  jest.useRealTimers();
});
it('deletes a listed original and updates count, detail and reflection while preserving the flock and other nights', async () => {
  jest.useFakeTimers();
  const source = createSettingsMorning();
  await render(
    <MorningScreen
      actions={source}
      loadDetail={source.loadSheep}
      onExit={() => {}}
    />,
  );
  await tick();
  await tick();
  await press('설정 열기');
  await tick();
  await press('고민 기록 열기');
  await tick();
  expect(
    screen.getByRole('button', { name: '2026-11-10 고민 삭제' }),
  ).toBeTruthy();
  const remove = jest.spyOn(source.worries!, 'remove');
  await press('2026-11-10 고민 삭제');
  await press('취소');
  expect(remove).not.toHaveBeenCalled();
  await press('2026-11-10 고민 삭제');
  await press('지우기');
  await tick();
  expect(
    screen.queryByText('면접 결과가 내일 나오는데 계속 생각나서 잠이 안 와요.'),
  ).toBeNull();
  expect(screen.getByText('고민 기록 2개')).toBeTruthy();
  expect(screen.getByText('연락이 뜸해진 게 자꾸 신경 쓰여요.')).toBeTruthy();
  await press('설정으로 돌아가기');
  await tick();
  expect(screen.getByText('2개')).toBeTruthy();
  await press('아침 홈으로 돌아가기');
  expect(screen.getByRole('button', { name: '2026-11-10의 양' })).toBeTruthy();
  await press('2026-11-10의 양');
  await tick();
  expect(screen.getByText('남아 있는 고민 기록이 없어요.')).toBeTruthy();
  expect(screen.getByText('잠깐의 쉼 (예시)')).toBeTruthy();
  expect(screen.getByText('그대로예요')).toBeTruthy();
  await press('양떼로 돌아가기');
  await press('어젯밤 돌아보기');
  await tick();
  expect(screen.getByText('저장된 회고 · 그대로예요')).toBeTruthy();
  expect(screen.queryAllByRole('radio')).toHaveLength(0);
});
async function openList(source: ReturnType<typeof createSettingsMorning>) {
  await render(
    <MorningScreen
      actions={source}
      loadDetail={source.loadSheep}
      onExit={() => {}}
    />,
  );
  await tick();
  await tick();
  await press('설정 열기');
  await tick();
  await press('고민 기록 열기');
  await tick();
}
it.each(['delete-retry', 'delete-lost'] as const)(
  'retains uncertain %s and retries the same night without decrementing twice',
  async (scenario) => {
    jest.useFakeTimers();
    const source = createSettingsMorning(scenario);
    const remove = jest.spyOn(source.worries!, 'remove');
    await openList(source);
    await press('2026-11-10 고민 삭제');
    await press('지우기');
    await tick();
    expect(screen.getByText('삭제 결과를 확인하지 못했어요')).toBeTruthy();
    await press('취소');
    expect(screen.getByText('고민 기록 3개')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: '2026-11-10 고민 삭제' }),
    ).toBeTruthy();
    await press('2026-11-10 고민 삭제');
    await press('지우기');
    await tick();
    expect(screen.getByText('고민 기록 2개')).toBeTruthy();
    expect(remove.mock.calls.map((c) => c[0])).toEqual([
      'preview-night',
      'preview-night',
    ]);
    await act(async () => {
      const pending = source.worries!.remove(
        'preview-night',
        new AbortController().signal,
      );
      await jest.runAllTimersAsync();
      await pending;
    });
    expect(screen.getByText('고민 기록 2개')).toBeTruthy();
  },
);
it('removes a detail-deleted original from settings and preserves every other remaining night', async () => {
  jest.useFakeTimers();
  const source = createSettingsMorning();
  await openList(source);
  await press('설정으로 돌아가기');
  await press('아침 홈으로 돌아가기');
  await press('2026-11-09의 양');
  await tick();
  expect(screen.getByText('연락이 뜸해진 게 자꾸 신경 쓰여요.')).toBeTruthy();
  await press('고민 삭제');
  await press('지우기');
  await tick();
  await press('양떼로 돌아가기');
  await press('설정 열기');
  await tick();
  expect(screen.getByText('2개')).toBeTruthy();
  await press('고민 기록 열기');
  await tick();
  expect(
    screen.queryByRole('button', { name: '2026-11-09 고민 삭제' }),
  ).toBeNull();
  expect(
    screen.getByRole('button', { name: '2026-11-10 고민 삭제' }),
  ).toBeTruthy();
  expect(
    screen.getByRole('button', { name: '2026-11-08 고민 삭제' }),
  ).toBeTruthy();
});
it('resets a consumed cursor after deletion so the next remaining record is not skipped', async () => {
  jest.useFakeTimers();
  const source = createSettingsMorning('paged');
  await openList(source);
  await press('더 보기');
  await tick();
  expect(screen.getByText('시험을 앞두고 마음이 복잡해요.')).toBeTruthy();
  await press('2026-11-10 고민 삭제');
  await press('지우기');
  await tick();
  expect(screen.getByText('고민 기록 2개')).toBeTruthy();
  expect(screen.getByText('연락이 뜸해진 게 자꾸 신경 쓰여요.')).toBeTruthy();
  expect(screen.getByText('시험을 앞두고 마음이 복잡해요.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: '더 보기' })).toBeNull();
});
it.each(['refresh-retry', 'count-retry'] as const)(
  'keeps confirmed deletion safe when %s fails and provides recovery',
  async (scenario) => {
    jest.useFakeTimers();
    const source = createSettingsMorning(scenario);
    await openList(source);
    await press('2026-11-10 고민 삭제');
    await press('지우기');
    await tick();
    expect(
      screen.queryByRole('button', { name: '2026-11-10 고민 삭제' }),
    ).toBeNull();
    expect(screen.getByText('연락이 뜸해진 게 자꾸 신경 쓰여요.')).toBeTruthy();
    if (scenario === 'count-retry') {
      expect(screen.queryByText('고민 기록 3개')).toBeNull();
      await press('기록 개수 다시 확인');
    } else await press('목록 다시 확인');
    await tick();
    expect(screen.getByText('고민 기록 2개')).toBeTruthy();
  },
);
it('shows an empty list and zero count after deleting every original while preserving all sheep', async () => {
  jest.useFakeTimers();
  const source = createSettingsMorning();
  await openList(source);
  for (const date of ['2026-11-10', '2026-11-09', '2026-11-08']) {
    await press(date + ' 고민 삭제');
    await press('지우기');
    await tick();
  }
  expect(screen.getByText('저장된 고민 없음')).toBeTruthy();
  expect(screen.getByText('고민 기록 0개')).toBeTruthy();
  await press('설정으로 돌아가기');
  await tick();
  expect(screen.getByText('0개')).toBeTruthy();
  await press('아침 홈으로 돌아가기');
  expect(
    screen.getAllByRole('button', { name: /2026-11-\d+의 양/ }),
  ).toHaveLength(7);
});
it('blocks duplicate requests and modal back/cancel during a slow list deletion', async () => {
  jest.useFakeTimers();
  const source = createSettingsMorning('delete-slow');
  const remove = jest.spyOn(source.worries!, 'remove');
  await openList(source);
  await press('2026-11-10 고민 삭제');
  await press('지우기');
  await press('삭제 확인 중');
  await fireEvent(screen.getByTestId('worry-delete-modal'), 'requestClose');
  expect(screen.getByRole('button', { name: '취소' })).toBeDisabled();
  expect(remove).toHaveBeenCalledTimes(1);
  await tick();
  expect(screen.queryByTestId('worry-delete-modal')).toBeNull();
  expect(screen.getByText('고민 기록 2개')).toBeTruthy();
});
it('reconciles the count on returning from a lost-response dialog that was cancelled', async () => {
  jest.useFakeTimers();
  const source = createSettingsMorning('delete-lost');
  await openList(source);
  await press('2026-11-10 고민 삭제');
  await press('지우기');
  await tick();
  await press('취소');
  await press('설정으로 돌아가기');
  await tick();
  expect(screen.getByText('2개')).toBeTruthy();
  await press('고민 기록 열기');
  await tick();
  expect(screen.getByText('고민 기록 2개')).toBeTruthy();
  expect(
    screen.queryByRole('button', { name: '2026-11-10 고민 삭제' }),
  ).toBeNull();
});

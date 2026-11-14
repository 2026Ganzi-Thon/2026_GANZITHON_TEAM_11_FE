import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { MorningScreen } from './MorningScreen';
import { createMockMorning } from '../../mocks/morning';
import { reflectionReplies } from '../../mocks/reflection';
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
const tick = () =>
  act(async () => {
    await jest.runAllTimersAsync();
  });
afterEach(() => {
  jest.useRealTimers();
});
it('deletes only the selected original, retains the sheep/card/reply and disables new morning reflection', async () => {
  jest.useFakeTimers();
  const source = createMockMorning(
    'existing',
    'success',
    'existing',
    'success',
  );
  await render(
    <MorningScreen
      actions={source}
      loadDetail={source.loadSheep}
      onExit={() => {}}
    />,
  );
  await tick();
  await tick();
  await press('2026-11-10의 양');
  await tick();
  expect(screen.getByRole('button', { name: '고민 삭제' })).toBeTruthy();
  const remove = jest.spyOn(source.worries!, 'remove');
  await press('고민 삭제');
  await press('취소');
  expect(remove).not.toHaveBeenCalled();
  expect(
    screen.getByText('면접 결과가 내일 나오는데 계속 생각나서 잠이 안 와요.'),
  ).toBeTruthy();
  await press('고민 삭제');
  await press('지우기');
  await tick();
  expect(remove).toHaveBeenCalledWith('preview-night', expect.any(AbortSignal));
  expect(
    screen.queryByText('면접 결과가 내일 나오는데 계속 생각나서 잠이 안 와요.'),
  ).toBeNull();
  expect(screen.getByText('잠깐의 쉼 (예시)')).toBeTruthy();
  expect(screen.getByText(reflectionReplies.smaller)).toBeTruthy();
  await press('양떼로 돌아가기');
  expect(screen.getByRole('button', { name: '2026-11-10의 양' })).toBeTruthy();
  await press('어젯밤 돌아보기');
  await tick();
  expect(screen.getByText('남아 있는 고민 기록이 없어요.')).toBeTruthy();
  expect(screen.getByText(reflectionReplies.smaller)).toBeTruthy();
  expect(screen.queryAllByRole('radio')).toHaveLength(0);
  expect(screen.queryByRole('button', { name: '회고 저장하기' })).toBeNull();
  await press('양떼로 돌아가기');
  await press('2026-11-10의 양');
  await tick();
  expect(screen.queryByRole('button', { name: '고민 삭제' })).toBeNull();
  const earlier = source.loadSheep(
    'preview-sheep-0',
    new AbortController().signal,
  );
  await tick();
  expect((await earlier).night.worry_text).toBeTruthy();
});
it.each(['retry', 'lost-response'] as const)(
  'retains original on uncertain %s and recovers with the same night ID',
  async (scenario) => {
    jest.useFakeTimers();
    const source = createMockMorning(
      'existing',
      'success',
      'existing',
      scenario,
    );
    const remove = jest.spyOn(source.worries!, 'remove');
    await render(
      <MorningScreen
        actions={source}
        loadDetail={source.loadSheep}
        onExit={() => {}}
      />,
    );
    await tick();
    await tick();
    await press('2026-11-10의 양');
    await tick();
    await press('고민 삭제');
    await press('지우기');
    await tick();
    expect(screen.getByText('삭제 결과를 확인하지 못했어요')).toBeTruthy();
    expect(source.worries!.isDeleted('preview-night')).toBe(false);
    await press('다시 지우기');
    await tick();
    expect(remove.mock.calls.map((c) => c[0])).toEqual([
      'preview-night',
      'preview-night',
    ]);
    expect(screen.queryByTestId('worry-delete-modal')).toBeNull();
    const record = source.reflection.load(
      'preview-night',
      new AbortController().signal,
    );
    await tick();
    expect((await record).night).toMatchObject({
      id: 'preview-night',
      category_id: 'career',
      worry_text: null,
      worry_saved_at: null,
    });
    expect((await record).reflection?.answer).toBe('smaller');
  },
);
it('blocks duplicate delete and back/cancel while pending; reopening the home retains deletion', async () => {
  jest.useFakeTimers();
  const source = createMockMorning('existing', 'success', 'success', 'slow');
  const remove = jest.spyOn(source.worries!, 'remove');
  await render(
    <MorningScreen
      actions={source}
      loadDetail={source.loadSheep}
      onExit={() => {}}
    />,
  );
  await tick();
  await tick();
  await press('2026-11-10의 양');
  await tick();
  await press('고민 삭제');
  await press('지우기');
  expect(screen.getByRole('button', { name: '삭제 확인 중' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '취소' })).toBeDisabled();
  await fireEvent(screen.getByTestId('worry-delete-modal'), 'requestClose');
  expect(screen.getByTestId('worry-delete-modal')).toBeTruthy();
  await press('삭제 확인 중');
  expect(remove).toHaveBeenCalledTimes(1);
  await tick();
  await screen.unmount();
  await render(
    <MorningScreen
      actions={source}
      loadDetail={source.loadSheep}
      onExit={() => {}}
    />,
  );
  await tick();
  await tick();
  await press('어젯밤 돌아보기');
  await tick();
  expect(screen.queryAllByRole('radio')).toHaveLength(0);
  expect(screen.queryByRole('button', { name: '회고 저장하기' })).toBeNull();
});

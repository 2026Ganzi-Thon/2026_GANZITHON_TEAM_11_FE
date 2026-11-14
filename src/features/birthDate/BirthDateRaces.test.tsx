import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { BirthDateScreen } from './BirthDateScreen';
import type {
  BirthDateActions,
  BirthDateResult,
  BirthDateSnapshot,
} from './types';
import { createMockBirthDate } from '../../mocks/birthDate';
const tick = () =>
  act(async () => {
    await jest.runAllTimersAsync();
  });
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
const select = () =>
  fireEvent(
    screen.getByRole('adjustable', { name: '출생 월' }),
    'accessibilityAction',
    { nativeEvent: { actionName: 'increment' } },
  );
afterEach(() => {
  jest.useRealTimers();
});
it.each(['success', 'failure'] as const)(
  'aborts previous source saves and ignores their late %s',
  async (mode) => {
    jest.useFakeTimers();
    let finish!: (v: BirthDateResult) => void;
    let fail!: (v: Error) => void;
    const old = createMockBirthDate();
    const save = jest.fn<BirthDateActions['save']>().mockImplementation(
      () =>
        new Promise((r, j) => {
          finish = r;
          fail = j;
        }),
    );
    old.save = save;
    await render(<BirthDateScreen actions={old} onBack={() => {}} />);
    await tick();
    await select();
    await press('한 번만 바꿀 수 있어요!');
    await press('이 생일로 변경하기');
    const next = createMockBirthDate();
    await screen.rerender(<BirthDateScreen actions={next} onBack={() => {}} />);
    await tick();
    expect(save.mock.calls[0][1].aborted).toBe(true);
    await act(async () => {
      if (mode === 'success')
        finish({
          birth_date: '2004-06-14',
          edits_remaining: 0,
          zodiac: 'gemini',
        });
      else fail(new Error('late private failure'));
    });
    expect(screen.getByText('남은 수정 1회')).toBeTruthy();
    expect(screen.queryByText('생년월일을 변경했어요.')).toBeNull();
    expect(screen.queryByText('변경 결과를 확인하지 못했어요')).toBeNull();
  },
);
it('aborts an initial read on close and does not display its late snapshot', async () => {
  let finish!: (v: BirthDateSnapshot) => void;
  const actions = createMockBirthDate();
  const load = jest.fn<BirthDateActions['load']>().mockImplementation(
    () =>
      new Promise((r) => {
        finish = r;
      }),
  );
  actions.load = load;
  const back = jest.fn();
  await render(<BirthDateScreen actions={actions} onBack={back} />);
  await press('생년월일 변경 닫기');
  expect(load.mock.calls[0][0].aborted).toBe(true);
  await act(async () =>
    finish({
      birth_date: '2004-05-14',
      edits_remaining: 1,
      zodiac: 'taurus',
      today: '2026-11-14',
    }),
  );
  expect(screen.queryByText('생일을 바꿀까요?')).toBeNull();
  expect(back).toHaveBeenCalledTimes(1);
});
it.each([
  { birth_date: '2004-06-15' },
  { edits_remaining: 1 },
  { zodiac: 'unknown' },
])('rejects an inconsistent save response field %j', async (invalid) => {
  jest.useFakeTimers();
  const actions = createMockBirthDate();
  actions.save = async () =>
    ({
      ...{ birth_date: '2004-06-14', edits_remaining: 0, zodiac: 'gemini' },
      ...invalid,
    }) as BirthDateResult;
  await render(<BirthDateScreen actions={actions} onBack={() => {}} />);
  await tick();
  await select();
  await press('한 번만 바꿀 수 있어요!');
  await press('이 생일로 변경하기');
  await tick();
  expect(screen.getByText('변경 결과를 확인하지 못했어요')).toBeTruthy();
  expect(screen.queryByText('생년월일을 변경했어요.')).toBeNull();
  expect(screen.getByText('2004년 6월 14일')).toBeTruthy();
});
it('clamps leap day in the actual wheel before constructing the submitted date', async () => {
  const actions: BirthDateActions = {
    load: async () => ({
      birth_date: '2004-02-29',
      edits_remaining: 1,
      zodiac: 'pisces',
      today: '2026-11-14',
    }),
    save: jest.fn<BirthDateActions['save']>().mockResolvedValue({
      birth_date: '2005-02-28',
      edits_remaining: 0,
      zodiac: 'pisces',
    }),
  };
  await render(<BirthDateScreen actions={actions} onBack={() => {}} />);
  await fireEvent(
    screen.getByRole('adjustable', { name: '출생 연도' }),
    'accessibilityAction',
    { nativeEvent: { actionName: 'increment' } },
  );
  expect(
    screen.getByRole('adjustable', { name: '출생 일' }),
  ).toHaveAccessibilityValue({ now: 28 });
  await press('한 번만 바꿀 수 있어요!');
  await press('이 생일로 변경하기');
  expect(actions.save).toHaveBeenCalledWith(
    '2005-02-28',
    expect.any(AbortSignal),
  );
  expect(screen.getByText('생년월일을 변경했어요.')).toBeTruthy();
});

import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { BirthDateScreen } from './BirthDateScreen';
import { createMockBirthDate } from '../../mocks/birthDate';
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
const tick = () =>
  act(async () => {
    await jest.runAllTimersAsync();
  });
const nextMonth = () =>
  fireEvent(
    screen.getByRole('adjustable', { name: '출생 월' }),
    'accessibilityAction',
    { nativeEvent: { actionName: 'increment' } },
  );
afterEach(() => {
  jest.useRealTimers();
});
it('confirms the selected date before saving and displays the returned date, zodiac and exhausted quota', async () => {
  jest.useFakeTimers();
  const actions = createMockBirthDate();
  const save = jest.spyOn(actions, 'save');
  await render(<BirthDateScreen actions={actions} onBack={() => {}} />);
  await tick();
  expect(screen.getByText('남은 수정 1회')).toBeTruthy();
  expect(
    screen.getByRole('button', { name: '한 번만 바꿀 수 있어요!' }),
  ).toBeDisabled();
  await nextMonth();
  await press('한 번만 바꿀 수 있어요!');
  expect(save).not.toHaveBeenCalled();
  expect(screen.getByText('2004년 6월 14일')).toBeTruthy();
  await press('계속 선택하기');
  expect(save).not.toHaveBeenCalled();
  await press('한 번만 바꿀 수 있어요!');
  await press('이 생일로 변경하기');
  await tick();
  expect(save).toHaveBeenCalledWith('2004-06-14', expect.any(AbortSignal));
  expect(screen.getByText('생년월일을 변경했어요.')).toBeTruthy();
  expect(screen.getByText('쌍둥이자리')).toBeTruthy();
  expect(screen.getByText('남은 수정 0회')).toBeTruthy();
  await screen.unmount();
  await render(<BirthDateScreen actions={actions} onBack={() => {}} />);
  await tick();
  expect(screen.getByText('수정 가능한 횟수를 모두 사용했어요.')).toBeTruthy();
  expect(
    screen.getByRole('button', { name: '변경할 수 없어요' }),
  ).toBeDisabled();
});
it('handles a synchronous loader failure as a retryable state without exposing its detail', async () => {
  const actions = createMockBirthDate();
  actions.load = () => {
    throw new Error('private loader detail');
  };
  await render(<BirthDateScreen actions={actions} onBack={() => {}} />);
  expect(screen.getByText('생년월일을 불러오지 못했어요.')).toBeTruthy();
  expect(screen.queryByText('private loader detail')).toBeNull();
});
it.each(['save-retry', 'lost-response', 'invalid-response'] as const)(
  'keeps the same target after %s and recovers without spending twice',
  async (scenario) => {
    jest.useFakeTimers();
    const actions = createMockBirthDate(scenario);
    const save = jest.spyOn(actions, 'save');
    await render(<BirthDateScreen actions={actions} onBack={() => {}} />);
    await tick();
    await nextMonth();
    await press('한 번만 바꿀 수 있어요!');
    await press('이 생일로 변경하기');
    await tick();
    expect(screen.getByText('변경 결과를 확인하지 못했어요')).toBeTruthy();
    expect(screen.queryAllByRole('adjustable')).toHaveLength(0);
    expect(screen.queryByText('생년월일을 변경했어요.')).toBeNull();
    await press('같은 날짜로 다시 확인');
    await tick();
    expect(save.mock.calls.map((c) => c[0])).toEqual([
      '2004-06-14',
      '2004-06-14',
    ]);
    expect(screen.getByText('남은 수정 0회')).toBeTruthy();
    expect(screen.getByText('생년월일을 변경했어요.')).toBeTruthy();
  },
);
it.each(['validation-error', 'age-rejected'] as const)(
  'keeps selected values and quota when %s is rejected',
  async (scenario) => {
    jest.useFakeTimers();
    const actions = createMockBirthDate(scenario);
    await render(<BirthDateScreen actions={actions} onBack={() => {}} />);
    await tick();
    await nextMonth();
    await press('한 번만 바꿀 수 있어요!');
    await press('이 생일로 변경하기');
    await tick();
    expect(
      screen.getByRole('adjustable', { name: '출생 월' }),
    ).toHaveAccessibilityValue({ now: 6 });
    expect(screen.getByText('남은 수정 1회')).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
    await press('한 번만 바꿀 수 있어요!');
    await press('이 생일로 변경하기');
    await tick();
    expect(screen.getByText('생년월일을 변경했어요.')).toBeTruthy();
  },
);
it.each(['conflict', 'conflict-load-retry'] as const)(
  'refreshes authoritative quota after %s and does not automatically resubmit',
  async (scenario) => {
    jest.useFakeTimers();
    const actions = createMockBirthDate(scenario);
    const save = jest.spyOn(actions, 'save');
    await render(<BirthDateScreen actions={actions} onBack={() => {}} />);
    await tick();
    await nextMonth();
    await press('한 번만 바꿀 수 있어요!');
    await press('이 생일로 변경하기');
    await tick();
    if (scenario === 'conflict-load-retry') {
      expect(
        screen.getByText('최신 변경 상태를 확인하지 못했어요.'),
      ).toBeTruthy();
      expect(screen.queryAllByRole('adjustable')).toHaveLength(0);
      await press('변경 상태 다시 확인');
      await tick();
    }
    expect(screen.getByText('2002년 6월 15일')).toBeTruthy();
    expect(screen.getByText('선택한 생일을 저장하지 못했어요.')).toBeTruthy();
    expect(screen.getByText('남은 수정 0회')).toBeTruthy();
    expect(save).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('생년월일을 변경했어요.')).toBeNull();
  },
);
it('blocks duplicate submit and back while saving, then allows leaving the result', async () => {
  jest.useFakeTimers();
  const actions = createMockBirthDate('slow');
  const save = jest.spyOn(actions, 'save');
  const back = jest.fn();
  await render(<BirthDateScreen actions={actions} onBack={back} />);
  await tick();
  await nextMonth();
  await press('한 번만 바꿀 수 있어요!');
  await press('이 생일로 변경하기');
  expect(screen.getByRole('button', { name: '변경 확인 중' })).toBeDisabled();
  await press('변경 확인 중');
  await press('생년월일 변경 닫기');
  expect(back).not.toHaveBeenCalled();
  expect(save).toHaveBeenCalledTimes(1);
  await tick();
  await press('돌아가기');
  expect(back).toHaveBeenCalledTimes(1);
});
it('rejects future dates locally before any save and preserves the selected month', async () => {
  jest.useFakeTimers();
  const actions = createMockBirthDate(
    'success',
    () => new Date('2004-05-14T12:00:00Z'),
  );
  const save = jest.spyOn(actions, 'save');
  await render(<BirthDateScreen actions={actions} onBack={() => {}} />);
  await tick();
  await nextMonth();
  await press('한 번만 바꿀 수 있어요!');
  expect(screen.getByText('미래의 날짜는 선택할 수 없어요.')).toBeTruthy();
  expect(save).not.toHaveBeenCalled();
  expect(
    screen.getByRole('adjustable', { name: '출생 월' }),
  ).toHaveAccessibilityValue({ now: 6 });
});

import { describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { NightEntryScreen } from './NightEntryScreen';
import type { NightEntryActions } from './entry';

function actions() {
  return {
    checkWorry: jest
      .fn<NightEntryActions['checkWorry']>()
      .mockResolvedValue(undefined),
    startCounting: jest
      .fn<NightEntryActions['startCounting']>()
      .mockResolvedValue(undefined),
  };
}
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
const choose = (name: string) =>
  fireEvent.press(screen.getByRole('radio', { name }));
async function fill() {
  await choose('취업');
  await fireEvent.changeText(
    screen.getByLabelText('오늘의 고민'),
    ' 면접이 걱정돼요 ',
  );
}

describe('night entry preview', () => {
  it('requires a category and text, with a configurable length limit', async () => {
    const api = actions();
    await render(
      <NightEntryScreen actions={api} onBack={() => {}} worryLimit={5} />,
    );
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
    expect(screen.getByLabelText('오늘의 고민')).toHaveProp('editable', false);
    await choose('학업');
    await fireEvent.changeText(screen.getByLabelText('오늘의 고민'), '   ');
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('오늘의 고민'), '123456');
    await press('다음');
    expect(screen.getByText('5자 이내로 적어 주세요.')).toBeTruthy();
    expect(api.checkWorry).not.toHaveBeenCalled();
  });
  it('selects only one category, disables no-worry input, and sends null', async () => {
    const api = actions();
    await render(<NightEntryScreen actions={api} onBack={() => {}} />);
    await fill();
    await choose('고민 없음');
    expect(screen.getByRole('radio', { name: '취업' })).not.toBeSelected();
    expect(screen.getByRole('radio', { name: '고민 없음' })).toBeSelected();
    expect(screen.getByLabelText('오늘의 고민')).toHaveProp('editable', false);
    expect(screen.getByLabelText('오늘의 고민')).toHaveDisplayValue('');
    await press('다음');
    expect(api.checkWorry).toHaveBeenCalledWith(
      { category_id: 'none', worry_text: null },
      expect.any(AbortSignal),
    );
    expect(screen.getByText('오늘은 몇 마리 셀까요?')).toBeTruthy();
    await press('뒤로');
    await choose('취업');
    expect(screen.getByLabelText('오늘의 고민')).toHaveDisplayValue(
      ' 면접이 걱정돼요 ',
    );
  });
  it('preserves the draft and count when returning, with bounds and presets', async () => {
    const api = actions();
    await render(<NightEntryScreen actions={api} onBack={() => {}} />);
    await fill();
    await press('다음');
    expect(api.checkWorry).toHaveBeenCalledWith(
      { category_id: 'career', worry_text: '면접이 걱정돼요' },
      expect.any(AbortSignal),
    );
    expect(screen.getByLabelText('선택한 양 수')).toHaveTextContent('15마리');
    await choose('3마리');
    expect(
      screen.getByRole('button', { name: '한 마리 줄이기' }),
    ).toBeDisabled();
    await press('한 마리 줄이기');
    expect(screen.getByLabelText('선택한 양 수')).toHaveTextContent('3마리');
    await choose('30마리');
    expect(
      screen.getByRole('button', { name: '한 마리 늘리기' }),
    ).toBeDisabled();
    await press('한 마리 늘리기');
    await press('한 마리 줄이기');
    expect(screen.getByLabelText('선택한 양 수')).toHaveTextContent('29마리');
    await press('뒤로');
    expect(screen.getByLabelText('오늘의 고민')).toHaveDisplayValue(
      ' 면접이 걱정돼요 ',
    );
    expect(screen.getByRole('radio', { name: '취업' })).toBeSelected();
    await press('다음');
    expect(screen.getByLabelText('선택한 양 수')).toHaveTextContent('29마리');
    await press('양 세기 시작');
    expect(api.startCounting).toHaveBeenCalledWith(29, expect.any(AbortSignal));
    expect(screen.getByText('미리보기를 마쳤어요')).toBeTruthy();
    expect(
      screen.getByText(/실제 저장·안전 확인·양 세기는 진행하지 않았어요/),
    ).toBeTruthy();
  });
  it('keeps input on failure, hides raw errors, and permits retry on each step', async () => {
    const api = actions();
    api.checkWorry.mockRejectedValueOnce(new Error('private-content'));
    api.startCounting.mockRejectedValueOnce(new Error('private-content'));
    await render(<NightEntryScreen actions={api} onBack={() => {}} />);
    await fill();
    await press('다음');
    expect(screen.getByLabelText('오늘의 고민')).toHaveDisplayValue(
      ' 면접이 걱정돼요 ',
    );
    expect(screen.queryByText('private-content')).toBeNull();
    await press('다시 시도');
    await choose('10마리');
    await press('양 세기 시작');
    expect(screen.getByLabelText('선택한 양 수')).toHaveTextContent('10마리');
    await press('다시 시도');
    expect(screen.getByText('미리보기를 마쳤어요')).toBeTruthy();
  });
  it('blocks duplicate worry submissions and aborts when leaving', async () => {
    const api = actions();
    let finish!: () => void;
    api.checkWorry.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const onBack = jest.fn();
    await render(<NightEntryScreen actions={api} onBack={onBack} />);
    await fill();
    await press('다음');
    await press('확인 중');
    expect(api.checkWorry).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('오늘의 고민')).toHaveProp('editable', false);
    await press('뒤로');
    expect(api.checkWorry.mock.calls[0][1].aborted).toBe(true);
    expect(onBack).toHaveBeenCalledTimes(1);
    await act(async () => finish());
    expect(screen.queryByText('오늘은 몇 마리 셀까요?')).toBeNull();
  });
  it('ignores a late count completion after backing out and permits a new attempt', async () => {
    const api = actions();
    let finish!: () => void;
    api.startCounting.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await render(<NightEntryScreen actions={api} onBack={() => {}} />);
    await choose('고민 없음');
    await press('다음');
    await press('양 세기 시작');
    await press('준비 중');
    expect(api.startCounting).toHaveBeenCalledTimes(1);
    await press('뒤로');
    expect(api.startCounting.mock.calls[0][1].aborted).toBe(true);
    await press('다음');
    await act(async () => finish());
    expect(screen.queryByText('미리보기를 마쳤어요')).toBeNull();
    await press('양 세기 시작');
    expect(screen.getByText('미리보기를 마쳤어요')).toBeTruthy();
  });
  it('aborts the pending operation on unmount', async () => {
    const api = actions();
    api.checkWorry.mockImplementation(() => new Promise(() => {}));
    await render(<NightEntryScreen actions={api} onBack={() => {}} />);
    await choose('고민 없음');
    await press('다음');
    await screen.unmount();
    expect(api.checkWorry.mock.calls[0][1].aborted).toBe(true);
  });
});

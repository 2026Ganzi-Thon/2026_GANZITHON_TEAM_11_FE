import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createMockTextCards } from '../../mocks/textCards';
import { TextCardScreen } from './TextCardScreen';
import type { TextCardActions, TextCardSubmission } from './types';
const press = (label: string) =>
  fireEvent.press(screen.getByRole('button', { name: label }));
const tick = () =>
  act(async () => {
    await jest.runAllTimersAsync();
  });
const setup = (
  actions: TextCardActions = createMockTextCards(),
  onBack = () => {},
  onDone = () => {},
) =>
  render(
    <TextCardScreen
      actions={actions}
      sourceNightId="preview-night"
      onBack={onBack}
      onDone={onDone}
    />,
  );
async function write(text = '오늘도 애썼어요.') {
  await fireEvent.press(screen.getByRole('radio', { name: '취업' }));
  await press('다음');
  await fireEvent.changeText(screen.getByLabelText('짧은 글'), text);
}
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
describe('short text cards', () => {
  it('requires one of seven categories and validates trimmed Unicode content without truncation', async () => {
    await setup();
    expect(screen.getAllByRole('radio')).toHaveLength(7);
    expect(screen.queryByRole('radio', { name: '고민 없음' })).toBeNull();
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
    await write('   ');
    expect(
      screen.getByRole('button', { name: '검수 요청하기' }),
    ).toBeDisabled();
    await fireEvent.changeText(
      screen.getByLabelText('짧은 글'),
      '🙂'.repeat(201),
    );
    expect(screen.getByDisplayValue('🙂'.repeat(201))).toBeTruthy();
    expect(
      screen.getByRole('button', { name: '검수 요청하기' }),
    ).toBeDisabled();
    await fireEvent.changeText(
      screen.getByLabelText('짧은 글'),
      ' ' + '🙂'.repeat(200) + ' ',
    );
    expect(screen.getByText('200 / 200')).toBeTruthy();
    expect(screen.getByRole('button', { name: '검수 요청하기' })).toBeEnabled();
  });
  it('prevents duplicate submits and replaces the form with a pending receipt, then finishes on back', async () => {
    let resolve!: (v: TextCardSubmission) => void;
    const actions = createMockTextCards();
    const submit = jest.spyOn(actions, 'submit').mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const done = jest.fn();
    await setup(actions, () => {}, done);
    await write('  오늘도 애썼어요.  ');
    await press('검수 요청하기');
    await press('검수 요청하기');
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit.mock.calls[0][0]).toEqual({
      kind: 'text',
      category_id: 'career',
      content: { text: '오늘도 애썼어요.' },
      source_night_id: 'preview-night',
    });
    await act(async () =>
      resolve({
        id: 'c1',
        kind: 'text',
        category_id: 'career',
        content: { text: '오늘도 애썼어요.' },
        moderation_status: 'pending',
      }),
    );
    expect(screen.getByText('카드를 맡겼어요')).toBeTruthy();
    expect(screen.getByText('검수를 기다리고 있어요.')).toBeTruthy();
    expect(screen.queryByLabelText('짧은 글')).toBeNull();
    await press('이제 잘게요');
    expect(done).toHaveBeenCalledTimes(1);
  });
  it('retries a lost response with the same body and key, including after a close and reopen', async () => {
    jest.useFakeTimers();
    const actions = createMockTextCards('lost-response');
    const submit = jest.spyOn(actions, 'submit');
    const view = await setup(actions);
    await write();
    await press('검수 요청하기');
    await tick();
    expect(screen.getByText('접수를 확인하지 못했어요')).toBeTruthy();
    await view.unmount();
    await setup(actions);
    expect(screen.getByDisplayValue('오늘도 애썼어요.')).toBeTruthy();
    await press('검수 요청하기');
    await tick();
    expect(submit.mock.calls[1].slice(0, 2)).toEqual(
      submit.mock.calls[0].slice(0, 2),
    );
    expect(screen.getByText('카드를 맡겼어요')).toBeTruthy();
  });
  it('preserves a draft and changes the key only when the category or trimmed body changes', async () => {
    const actions = createMockTextCards();
    await setup(actions);
    await write();
    const old = actions.readDraft();
    await press('이전');
    await fireEvent.press(screen.getByRole('radio', { name: '학업' }));
    await press('다음');
    expect(screen.getByDisplayValue(old.text)).toBeTruthy();
    expect(actions.readDraft().operationKey).not.toBe(old.operationKey);
  });
  it.each(['field-error', 'support', 'safety-unavailable'] as const)(
    'retains the draft after %s and allows a corrected retry',
    async (scenario) => {
      jest.useFakeTimers();
      const actions = createMockTextCards(scenario);
      await setup(actions);
      await write();
      await press('검수 요청하기');
      await tick();
      if (scenario === 'support') {
        expect(screen.getByText('제출을 잠시 멈췄어요')).toBeTruthy();
        expect(screen.queryByText('카드를 맡겼어요')).toBeNull();
        await press('쓰던 글로 돌아가기');
      } else if (scenario === 'field-error')
        expect(screen.getByText('글 내용을 다시 확인해 주세요.')).toBeTruthy();
      else
        expect(screen.getByText('지금은 검수를 요청할 수 없어요')).toBeTruthy();
      expect(screen.getByDisplayValue('오늘도 애썼어요.')).toBeTruthy();
      await press('검수 요청하기');
      await tick();
      expect(screen.getByText('카드를 맡겼어요')).toBeTruthy();
    },
  );
  it('ignores late completion after leaving and aborts on unmount', async () => {
    let resolve!: (v: TextCardSubmission) => void;
    const actions = createMockTextCards();
    const submit = jest.spyOn(actions, 'submit').mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const view = await setup(actions);
    await write();
    await press('검수 요청하기');
    await press('이전');
    expect(submit.mock.calls[0][2].aborted).toBe(true);
    await act(async () =>
      resolve({
        id: 'late',
        kind: 'text',
        category_id: 'career',
        content: { text: '오늘도 애썼어요.' },
        moderation_status: 'pending',
      }),
    );
    expect(screen.queryByText('카드를 맡겼어요')).toBeNull();
    await press('다음');
    await press('검수 요청하기');
    await view.unmount();
    expect(submit.mock.calls[1][2].aborted).toBe(true);
  });
  it.each(['category', 'text', 'status', 'id'] as const)(
    'rejects an invalid %s receipt instead of claiming acceptance',
    async (invalid) => {
      const actions = createMockTextCards();
      jest.spyOn(actions, 'submit').mockResolvedValue({
        id: 'c1',
        kind: 'text',
        category_id: 'study',
        content: { text: 'unrelated' },
        moderation_status: 'pending',
      });
      await setup(actions);
      await write();
      await press('검수 요청하기');
      expect(await screen.findByText('접수를 확인하지 못했어요')).toBeTruthy();
      expect(screen.queryByText('카드를 맡겼어요')).toBeNull();
      expect(screen.getByDisplayValue('오늘도 애썼어요.')).toBeTruthy();
    },
  );
  it('keeps a denied entry draft and does not display a completion', async () => {
    jest.useFakeTimers();
    await setup(createMockTextCards('entry-required'));
    await write();
    await press('검수 요청하기');
    await tick();
    expect(screen.getByText('작성할 수 있는 밤을 확인해 주세요')).toBeTruthy();
    expect(screen.getByDisplayValue('오늘도 애썼어요.')).toBeTruthy();
    expect(screen.queryByText('카드를 맡겼어요')).toBeNull();
  });
});

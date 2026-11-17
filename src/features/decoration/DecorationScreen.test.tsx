import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { DecorationScreen } from './DecorationScreen';
import { createMockMorning } from '../../mocks/morning';
import {
  createMockDecoration,
  type DecorationScenario,
} from '../../mocks/decoration';
import type { DecorationActions } from './types';
const tick = () =>
  act(async () => {
    await jest.runAllTimersAsync();
  });
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
const id = 'preview-sheep-0';
function source(scenario: DecorationScenario = 'success') {
  return createMockDecoration(createMockMorning().loadSheep, { scenario });
}
async function open(actions = source(), sheepId = id, modal = false) {
  const saved = jest.fn(),
    back = jest.fn();
  await render(
    <DecorationScreen
      modal={modal}
      actions={actions}
      sheepId={sheepId}
      onSaved={saved}
      onBack={back}
    />,
  );
  await tick();
  return { actions, saved, back };
}
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});
it('adds, moves, rotates, scales and deletes a sticker before saving the full visual result', async () => {
  const { saved } = await open();
  await press('별 스티커 붙이기');
  await press('오른쪽으로 이동');
  await press('오른쪽으로 회전');
  await press('크게');
  await press('동그라미 스티커 붙이기');
  await press('선택한 스티커 삭제');
  await press('저장');
  await tick();
  expect(saved).toHaveBeenCalledTimes(1);
  expect(saved.mock.calls[0][0]).toMatchObject({
    id,
    version: 2,
    placements: [
      { sticker_id: 'st-1', x: 0.55, y: 0.5, rotation: 15, scale: 1.25 },
    ],
  });
});
it('asks before discarding edits and keeps the draft when choosing to continue', async () => {
  const { back } = await open();
  await press('별 스티커 붙이기');
  await press('꾸미기 닫기');
  expect(back).not.toHaveBeenCalled();
  await press('계속 꾸미기');
  expect(screen.getByRole('button', { name: '붙인 별 1 선택' })).toBeTruthy();
  await press('꾸미기 닫기');
  await press('저장하지 않고 나가기');
  expect(back).toHaveBeenCalledTimes(1);
});
it.each(['save-lost', 'save-retry', 'verify-retry'] as const)(
  'requires a state read after %s and never quietly sends another write',
  async (scenario) => {
    const actions = source(scenario),
      save = jest.spyOn(actions, 'save'),
      { saved } = await open(actions);
    await press('별 스티커 붙이기');
    await press('저장');
    await tick();
    expect(saved).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: '저장' })).toBeNull();
    await press('저장 상태 확인');
    await tick();
    if (scenario === 'verify-retry') {
      expect(
        screen.getByRole('button', { name: '저장 상태 확인' }),
      ).toBeTruthy();
      await press('저장 상태 확인');
      await tick();
    }
    if (scenario === 'save-lost') {
      expect(saved).toHaveBeenCalledTimes(1);
    } else {
      expect(
        screen.getByRole('button', { name: '붙인 별 1 선택' }),
      ).toBeTruthy();
      await press('저장');
      await tick();
      expect(saved).toHaveBeenCalledTimes(1);
    }
    expect(save).toHaveBeenCalledTimes(scenario === 'save-lost' ? 1 : 2);
  },
);
it('shows conflicting server placements only after explicit replacement and preserves another sheep', async () => {
  const actions = source('conflict'),
    { saved } = await open(actions);
  await press('별 스티커 붙이기');
  await press('저장');
  await tick();
  await press('저장 상태 확인');
  await tick();
  expect(saved).not.toHaveBeenCalled();
  expect(screen.getByText(/최신 배치로 바꾸면/)).toBeTruthy();
  await press('최신 배치로 다시 꾸미기');
  expect(
    screen.getByRole('button', { name: '붙인 반짝별 1 선택' }),
  ).toBeTruthy();
  const b = actions.load('preview-sheep-1', new AbortController().signal);
  await tick();
  expect((await b).sheep.placements).toEqual([]);
});
it('blocks duplicate save and back while saving, including a modal requestClose', async () => {
  const { actions, saved, back } = await open(source('slow'), id, true);
  const spy = jest.spyOn(actions, 'save');
  await press('별 스티커 붙이기');
  await press('저장');
  await press('저장 중');
  await press('꾸미기 닫기');
  await fireEvent(screen.getByTestId('decoration-modal'), 'requestClose');
  expect(back).not.toHaveBeenCalled();
  expect(spy).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: '저장 중' })).toBeDisabled();
  await tick();
  expect(saved).toHaveBeenCalledTimes(1);
});
it('keeps the unsaved draft out of the flock when daytime ends during save', async () => {
  const { saved } = await open(source('night'));
  await press('별 스티커 붙이기');
  await press('저장');
  await tick();
  expect(saved).not.toHaveBeenCalled();
  expect(screen.getByText(/낮에만/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: '저장' })).toBeNull();
});
it('caps instances at twenty without removing previously placed stickers', async () => {
  await open();
  for (let n = 0; n < 20; n++) await press('별 스티커 붙이기');
  expect(
    screen.getAllByRole('button', { name: /붙인 별 \d+ 선택/ }),
  ).toHaveLength(20);
  expect(
    screen.getByRole('button', { name: '별 스티커 붙이기' }),
  ).toBeDisabled();
  await press('선택한 스티커 삭제');
  expect(
    screen.getByRole('button', { name: '별 스티커 붙이기' }),
  ).not.toBeDisabled();
});
it('blocks a failed asset and offers an explicit image retry', async () => {
  await open();
  await fireEvent(screen.getByTestId('catalog-image-st-1'), 'error', {
    nativeEvent: { error: 'load failed' },
  });
  expect(
    screen.getByRole('button', { name: '별 스티커 붙이기' }),
  ).toBeDisabled();
  expect(screen.getByRole('alert')).toBeTruthy();
  await press('스티커 그림 다시 불러오기');
  expect(
    screen.getByRole('button', { name: '별 스티커 붙이기' }),
  ).not.toBeDisabled();
});
it.each(['success', 'failure'])(
  'cancels the old sheep request and ignores its late %s on source replacement',
  async (outcome) => {
    let resolve!: (v: unknown) => void, reject!: (e: Error) => void;
    const promise = new Promise((yes, no) => {
      resolve = yes;
      reject = no;
    });
    const actions = source(),
      oldSave = jest
        .fn<DecorationActions['save']>()
        .mockImplementation(
          () => promise as ReturnType<DecorationActions['save']>,
        );
    actions.save = oldSave;
    const saved = jest.fn();
    const v = await render(
      <DecorationScreen
        actions={actions}
        sheepId={id}
        onSaved={saved}
        onBack={() => {}}
      />,
    );
    await tick();
    await press('별 스티커 붙이기');
    await press('저장');
    await v.rerender(
      <DecorationScreen
        actions={source()}
        sheepId="preview-sheep-1"
        onSaved={saved}
        onBack={() => {}}
      />,
    );
    await tick();
    expect(oldSave.mock.calls[0][2].aborted).toBe(true);
    await act(async () => {
      if (outcome === 'success') resolve({ id, version: 2, placements: [] });
      else reject(new Error('late'));
    });
    expect(saved).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /붙인 별/ })).toBeNull();
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
  },
);

it('does not promise to discard a possibly committed save and offers state verification before exit', async () => {
  const { back, saved } = await open(source('save-lost'));
  await press('별 스티커 붙이기');
  await press('저장');
  await tick();
  await press('꾸미기 닫기');
  expect(screen.queryByText('편집한 꾸미기는 사라져요.')).toBeNull();
  expect(
    screen.queryByRole('button', { name: '저장하지 않고 나가기' }),
  ).toBeNull();
  expect(screen.getByText(/이미 저장됐을 수도/)).toBeTruthy();
  await press('저장 상태 확인하기');
  await tick();
  expect(back).not.toHaveBeenCalled();
  expect(saved).toHaveBeenCalledTimes(1);
});
it('blocks selecting a failed placed sticker and blocks transforms while retaining explicit removal for a failed selection', async () => {
  await open();
  await press('별 스티커 붙이기');
  await fireEvent(screen.getByTestId('catalog-image-st-1'), 'error', {
    nativeEvent: { error: 'failed' },
  });
  expect(screen.getByRole('button', { name: '붙인 별 1 선택' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: '오른쪽으로 이동' })).toBeNull();
  expect(
    screen.getByRole('button', { name: '선택한 스티커 삭제' }),
  ).not.toBeDisabled();
  await press('동그라미 스티커 붙이기');
  await press('붙인 별 1 선택');
  expect(screen.getByText('선택한 스티커 · 동그라미')).toBeTruthy();
  await press('선택한 스티커 삭제');
});

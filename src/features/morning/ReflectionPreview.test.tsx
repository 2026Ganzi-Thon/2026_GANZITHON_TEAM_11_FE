import { describe, it, expect, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { MorningScreen } from './MorningScreen';
import { createMockMorning } from '../../mocks/morning';
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
const tick = () =>
  act(async () => {
    jest.advanceTimersByTime(650);
  });
describe('reflection integration', () => {
  it('saves to the same night, reopens, and shows the answer in its sheep only', async () => {
    jest.useFakeTimers();
    try {
      const actions = createMockMorning('existing');
      await render(
        <MorningScreen
          actions={actions}
          loadDetail={actions.loadSheep}
          onExit={() => {}}
        />,
      );
      await tick();
      await tick();
      await press('어젯밤 돌아보기');
      await tick();
      await fireEvent.press(screen.getByRole('radio', { name: '작아졌어요' }));
      await press('회고 저장하기');
      await tick();
      await press('양떼 보러 가기');
      await press('어젯밤 돌아보기');
      await tick();
      expect(screen.getByRole('radio', { name: '작아졌어요' })).toBeChecked();
      await press('양떼 보러 가기');
      await press('2026-11-10의 양');
      await tick();
      expect(screen.getByText('봐, 밤엔 커 보였던 거야.')).toBeTruthy();
      await press('양떼로 돌아가기');
      await press('2026-11-09의 양');
      await tick();
      expect(screen.queryByText('봐, 밤엔 커 보였던 거야.')).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});
it('native modal close aborts pending reflection loading', async () => {
  jest.useFakeTimers();
  try {
    const actions = createMockMorning('existing');
    const load = jest.spyOn(actions.reflection, 'load');
    await render(<MorningScreen actions={actions} onExit={() => {}} />);
    await tick();
    await tick();
    await press('어젯밤 돌아보기');
    const signal = load.mock.calls[0][1];
    await fireEvent(screen.getByTestId('reflection-modal'), 'requestClose');
    expect(signal.aborted).toBe(true);
    await tick();
    expect(screen.queryByText('이 걱정, 지금은 어때요?')).toBeNull();
  } finally {
    jest.useRealTimers();
  }
});

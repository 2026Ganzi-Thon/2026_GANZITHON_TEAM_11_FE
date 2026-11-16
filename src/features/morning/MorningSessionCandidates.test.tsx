import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { MorningScreen } from './MorningScreen';
import { createNightMorningDemo } from '../../mocks/nightMorningDemo';
import { signal, settle, start } from '../../mocks/__tests__/nightHistory';

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});
const tick = () =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(1000);
  });

async function twoSessions() {
  const demo = createNightMorningDemo('success');
  const firstCards = await start(demo, 3);
  async function close(count: number) {
    demo.progress({ position: 1, furthestPosition: 1 });
    const value = await settle(
      demo.closing.finish(
        {
          reason: 'leave',
          position: 1,
          furthestPosition: 1,
          sheepCount: count,
        },
        `finish-${count}`,
        signal(),
      ),
    );
    await settle(
      demo.closing.markViewed(
        value.closing_card!.id,
        `view-${count}`,
        signal(),
      ),
    );
    return value.closing_card!.id;
  }
  const firstClosing = await close(3);
  await settle(demo.closing.chooseWriting('morning', 'defer', signal()));
  demo.confirmClosing();
  await settle(demo.returning.create(5, signal()));
  const secondCards = await settle(demo.loadFeed(signal()));
  const secondClosing = await close(5);
  demo.advanceMorning();
  return {
    demo,
    ids: [firstCards[0].id, firstClosing, secondCards[0].id, secondClosing],
  };
}

it.each([
  ['1번째 세기 · 1번째 양', 0, 1, 3],
  ['1번째 세기 · 마무리 카드', 1, null, 3],
  ['2번째 세기 · 1번째 양', 2, 1, 5],
  ['2번째 세기 · 마무리 카드', 3, null, 5],
] as const)(
  'distinguishes %s by name and adopts its original card ID',
  async (label, index, position, count) => {
    const { demo, ids } = await twoSessions();
    const morning = await settle(demo.morning.loadMorning(signal()));
    const item = morning.candidate_cards.find(
      (candidate) => candidate.card.id === ids[index],
    );
    expect(item).toMatchObject({
      position,
      sheep_count: count,
      session_number: index < 2 ? 1 : 2,
    });
    const adopt = jest.spyOn(demo.morning, 'adopt');
    await render(<MorningScreen actions={demo.morning} onExit={() => {}} />);
    await tick();
    const radios = screen.getAllByRole('radio');
    expect(
      new Set(radios.map((radio) => radio.props.accessibilityLabel)).size,
    ).toBe(4);
    expect(screen.getByText(label)).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: label }));
    expect(screen.getByRole('radio', { name: label })).toBeChecked();
    expect(screen.getByText(`${label} · 짧은 글`)).toBeTruthy();
    await fireEvent.press(
      screen.getByRole('button', { name: '이 양 데려오기' }),
    );
    await tick();
    expect(adopt).toHaveBeenCalledTimes(1);
    expect(adopt).toHaveBeenCalledWith(
      demo.nightId,
      ids[index],
      expect.any(AbortSignal),
    );
    const detail = await settle(
      demo.morning.loadSheep(demo.getRecord().adopted!.id, signal()),
    );
    expect(detail).toMatchObject({
      card: { id: ids[index] },
      position,
      sheep_count: count,
    });
  },
);

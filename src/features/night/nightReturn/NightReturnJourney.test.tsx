import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { createNightMorningDemo } from '../../../mocks/nightMorningDemo';
import { createNightMorningNavigation } from '../../demo/navigation';
import { NightReturnJourney } from './NightReturnJourney';
import {
  start,
  finish,
  signal,
  settle,
} from '../../../mocks/__tests__/nightHistory';
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
const tick = async () => {
  for (let i = 0; i < 3; i++)
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });
};
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});
async function mount(
  scenario: Parameters<typeof createNightMorningDemo>[0] = 'success',
) {
  const demo = createNightMorningDemo(scenario, { nightDate: '2026-11-16' });
  await start(demo);
  demo.progress({ position: 3, furthestPosition: 3 });
  await finish(demo);
  await settle(demo.closing.chooseWriting('morning', 'defer', signal()));
  demo.confirmClosing();
  const onHome = jest.fn(),
    nav = createNightMorningNavigation();
  const create = jest.spyOn(demo.returning, 'create');
  await render(
    <SafeAreaInsetsContext.Provider
      value={{ top: 0, bottom: 0, left: 0, right: 0 }}
    >
      <NightReturnJourney
        demo={demo}
        navigation={nav}
        onHome={onHome}
        onExit={() => {}}
        onMorning={() => {}}
      />
    </SafeAreaInsetsContext.Provider>,
  );
  await tick();
  return { demo, create, onHome };
}
it('rechecks the finished night, opens N02 with the chosen count, then creates only on start', async () => {
  const { demo, create } = await mount();
  expect(screen.getByText('다시 깼구나, 괜찮아요')).toBeTruthy();
  await fireEvent.press(screen.getByRole('radio', { name: '5마리' }));
  await press('5마리 더 세기');
  await tick();
  expect(screen.getByText('오늘은 몇 마리 셀까요?')).toBeTruthy();
  expect(create).not.toHaveBeenCalled();
  await press('양 세기 시작');
  await tick();
  expect(create).toHaveBeenCalledTimes(1);
  expect(demo.getSession()?.sheepCount).toBe(5);
  expect(screen.getByText('1 / 5')).toBeTruthy();
});
it('recovers an uncertain creation through a query and never repeats create', async () => {
  const { create } = await mount('return-create-lost');
  await press('5마리 더 세기');
  await tick();
  await press('양 세기 시작');
  await tick();
  await tick();
  expect(screen.getByText('1 / 5')).toBeTruthy();
  expect(create).toHaveBeenCalledTimes(1);
});
it('rest exits without a create request', async () => {
  const { create, onHome } = await mount();
  await press('그냥 누워 있을게요');
  expect(onHome).toHaveBeenCalledTimes(1);
  expect(create).not.toHaveBeenCalled();
});
it('retries only the recovery read after an uncertain creation and a failed state lookup', async () => {
  const { create, demo } = await mount('return-create-lost');
  await press('5마리 더 세기');
  await tick();
  const load = jest
    .spyOn(demo.returning, 'load')
    .mockRejectedValueOnce(new Error('lookup unavailable'));
  await press('양 세기 시작');
  await tick();
  expect(screen.getByText('밤 기록을 불러오지 못했어요')).toBeTruthy();
  expect(create).toHaveBeenCalledTimes(1);
  await press('다시 불러오기');
  await tick();
  expect(screen.getByText('1 / 5')).toBeTruthy();
  expect(load).toHaveBeenCalledTimes(2);
  expect(create).toHaveBeenCalledTimes(1);
});
it('reopens the same writing draft from an unfinished closing before allowing another session', async () => {
  const demo = createNightMorningDemo('success', { nightDate: '2026-11-16' });
  await start(demo);
  demo.progress({ position: 3, furthestPosition: 3 });
  await finish(demo);
  await settle(demo.closing.chooseWriting('now', 'write', signal()));
  demo.cardWriting.choose({ category_id: 'career', kind: 'text' });
  demo.cardWriting.text.writeDraft({
    category_id: 'career',
    text: '남겨 둔 밤 초안',
  });
  const create = jest.spyOn(demo.returning, 'create');
  await render(
    <NightReturnJourney
      demo={demo}
      navigation={createNightMorningNavigation()}
      onHome={() => {}}
      onExit={() => {}}
      onMorning={() => {}}
    />,
  );
  await tick();
  await press('다음');
  expect(screen.getByLabelText('짧은 글')).toHaveDisplayValue(
    '남겨 둔 밤 초안',
  );
  expect(create).not.toHaveBeenCalled();
  expect(screen.queryByText('다시 깼구나, 괜찮아요')).toBeNull();
});

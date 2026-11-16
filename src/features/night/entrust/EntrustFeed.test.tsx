import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { FeedScreen } from '../feed/FeedScreen';
import { createNightMorningDemo } from '../../../mocks/nightMorningDemo';
import { start } from '../../../mocks/__tests__/nightHistory';
const tick = (ms = 2000) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
async function fixture(
  scenario: Parameters<typeof createNightMorningDemo>[0] = 'success',
) {
  const source = createNightMorningDemo(scenario);
  await start(source, 7);
  source.progress({ position: 4, furthestPosition: 4 });
  const exit = jest.fn(),
    finish = jest.fn();
  await render(
    <SafeAreaInsetsContext.Provider
      value={{ top: 28, bottom: 24, left: 0, right: 0 }}
    >
      <FeedScreen
        load={source.loadFeed}
        entrust={source.entrust}
        onProgress={source.progress}
        initialPosition={source.getProgress()}
        onFinish={finish}
        onBack={exit}
      />
    </SafeAreaInsetsContext.Provider>,
  );
  await tick();
  return { source, exit, finish };
}
it('shows the original worry as read-only, blocks moving/finishing during save and retains the confirmed choice on return', async () => {
  const { source, finish } = await fixture('entrust-slow');
  const save = jest.spyOn(source.entrust!, 'save');
  expect(screen.getByText('첫째 밤의 고민')).toBeTruthy();
  expect(screen.queryByLabelText('오늘의 고민')).toBeNull();
  await press('맡기기');
  expect(screen.getByRole('button', { name: '다음 양' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '이전 양' })).toBeDisabled();
  expect(
    screen.getByRole('button', { name: '그만 세고 싶어요' }),
  ).toBeDisabled();
  await press('다음 양');
  expect(source.getProgress().position).toBe(4);
  expect(finish).not.toHaveBeenCalled();
  await tick(5100);
  expect(
    screen.getByText('잘 받았어요. 오늘 밤은 내가 들고 있을게요.'),
  ).toBeTruthy();
  await tick();
  expect(source.getProgress().position).toBe(5);
  await press('이전 양');
  await tick();
  expect(source.getProgress().position).toBe(4);
  expect(
    screen.getByText('잘 받았어요. 오늘 밤은 내가 들고 있을게요.'),
  ).toBeTruthy();
  expect(screen.queryByRole('button', { name: '맡기기' })).toBeNull();
  expect(save).toHaveBeenCalledTimes(1);
});
it.each(['entrust-retry', 'entrust-lost-response'] as const)(
  'keeps the original selection for %s recovery and does not quietly skip it',
  async (scenario) => {
    const { source } = await fixture(scenario),
      save = jest.spyOn(source.entrust!, 'save');
    await press('맡기기');
    await tick(600);
    expect(screen.getByText('선택 결과를 확인하지 못했어요')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '그냥 넘기기' })).toBeNull();
    expect(screen.getByRole('button', { name: '다음 양' })).toBeDisabled();
    await press('선택 다시 시도');
    await tick(600);
    expect(source.getRecord().night?.entrusted).toBe(true);
    expect(save.mock.calls.map((c) => c[0])).toEqual([
      'entrusted',
      'entrusted',
    ]);
    await tick();
    expect(source.getProgress().position).toBe(5);
  },
);
it('persists skipping and never offers entrusting again when returning to the slot', async () => {
  const { source } = await fixture();
  await press('그냥 넘기기');
  await tick(600);
  await tick(2200);
  expect(source.getProgress().position).toBe(5);
  await press('이전 양');
  await tick();
  expect(screen.getByText('이 걱정은 넘겼어요.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: '맡기기' })).toBeNull();
  expect(source.getRecord().night?.entrusted).toBe(false);
});
it('does not restore erased worry text when the same feed is reopened', async () => {
  const { source } = await fixture();
  await screen.unmount();
  source.worryRecords.eraseRecord(source.nightId);
  await render(
    <SafeAreaInsetsContext.Provider
      value={{ top: 28, bottom: 24, left: 0, right: 0 }}
    >
      <FeedScreen
        load={source.loadFeed}
        entrust={source.entrust}
        onProgress={source.progress}
        initialPosition={source.getProgress()}
        onBack={() => {}}
      />
    </SafeAreaInsetsContext.Provider>,
  );
  await tick();
  expect(screen.queryByText('첫째 밤의 고민')).toBeNull();
  expect(screen.queryByRole('button', { name: '맡기기' })).toBeNull();
  await press('그냥 넘기기');
  await tick(600);
  await tick(2200);
  expect(source.getProgress().position).toBe(5);
});
it('refreshes a rejected pending choice after the worry is erased instead of replaying it forever', async () => {
  const { source } = await fixture('entrust-slow');
  await press('맡기기');
  source.worryRecords.eraseRecord(source.nightId);
  await tick(6000);
  expect(screen.queryByText('첫째 밤의 고민')).toBeNull();
  expect(screen.queryByRole('button', { name: '맡기기' })).toBeNull();
  expect(screen.getByRole('button', { name: '그냥 넘기기' })).toBeEnabled();
  expect(source.getRecord().night?.entrusted).toBe(false);
});

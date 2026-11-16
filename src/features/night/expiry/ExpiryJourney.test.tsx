import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import {
  act,
  fireEvent,
  render as nativeRender,
  screen,
} from '@testing-library/react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { HomeNightJourney } from '../../home/HomeNightJourney';
import { createNightExpiryPreview } from '../../../mocks/nightExpiryPreview';
import { signal, settle } from '../../../mocks/__tests__/nightHistory';
import { deferred } from '../../../notifications/__tests__/fakeDevice';
import type { TextCardSubmission } from '../../cards/types';
const tick = async () => {
  for (let i = 0; i < 3; i++)
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });
};
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
const render = (source: Awaited<ReturnType<typeof createNightExpiryPreview>>) =>
  nativeRender(
    <SafeAreaInsetsContext.Provider
      value={{ top: 28, bottom: 24, left: 0, right: 0 }}
    >
      <HomeNightJourney source={source} initialNightOpen onExit={() => {}} />
    </SafeAreaInsetsContext.Provider>,
  );
it.each(['partial', 'unseen', 'morning-retry'] as const)(
  'moves %s from the deadline notice through a fresh morning query without inventing viewed sheep',
  async (scenario) => {
    const source = await settle(createNightExpiryPreview(scenario, signal()));
    await render(source);
    await tick();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(31000);
    });
    expect(screen.getByText('밤이 끝났어요')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '다음 양' })).toBeNull();
    await press('아침으로 가기');
    await tick();
    if (scenario === 'morning-retry') {
      await press('다시 불러오기');
      await tick();
    }
    if (scenario === 'unseen') {
      expect(
        screen.queryByRole('button', { name: '이 양 데려오기' }),
      ).toBeNull();
      expect(source.history.getStats().counted_sheep_total).toBe(0);
    } else {
      await press('이 양 데려오기');
      await tick();
      expect(await source.history.loadFlock(signal())).toHaveLength(1);
      expect(source.history.getStats().counted_sheep_total).toBe(2);
    }
  },
);
it('hides a pending native writing modal at the deadline, aborts its request and ignores a late receipt while retaining the draft and key', async () => {
  const source = await settle(createNightExpiryPreview('writing', signal()));
  await render(source);
  await tick();
  await press('다음');
  await press('지금 쓸래요');
  await tick();
  expect(screen.getByLabelText('짧은 글')).toHaveDisplayValue(
    '마감 전에 적어 둔 초안이에요.',
  );
  const actions = source.night.cardWriting.text,
    original = actions.readDraft(),
    late = deferred<TextCardSubmission>();
  const submit = jest
    .spyOn(actions, 'submit')
    .mockImplementation(() => late.promise);
  await press('검수 요청하기');
  await act(async () => {
    await jest.advanceTimersByTimeAsync(31000);
  });
  expect(submit.mock.calls[0][2].aborted).toBe(true);
  expect(screen.queryByLabelText('짧은 글')).toBeNull();
  expect(screen.getByText('밤이 끝났어요')).toBeTruthy();
  await act(async () =>
    late.resolve({
      id: 'late-receipt',
      kind: 'text',
      category_id: 'career',
      content: { text: original.text },
      moderation_status: 'pending',
    }),
  );
  expect(screen.getByText('밤이 끝났어요')).toBeTruthy();
  expect(actions.readDraft()).toMatchObject({
    text: original.text,
    operationKey: original.operationKey,
  });
  submit.mockRestore();
  await press('아침으로 가기');
  await tick();
  await press('이 양 데려오기');
  await tick();
  await press('미뤄 둔 카드 쓰기');
  await tick();
  expect(screen.getByLabelText('짧은 글')).toHaveDisplayValue(original.text);
  expect(actions.readDraft().operationKey).toBe(original.operationKey);
});

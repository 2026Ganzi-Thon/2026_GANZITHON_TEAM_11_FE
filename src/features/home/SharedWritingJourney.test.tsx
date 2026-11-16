import { deferred } from '../../notifications/__tests__/fakeDevice';
import type { SubmissionPage } from '../myCards/types';
import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import {
  act,
  fireEvent,
  render as nativeRender,
  screen,
} from '@testing-library/react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { HomeNightJourney } from './HomeNightJourney';
import { createMockHomeJourney } from '../../mocks/homeJourney';
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
const tick = () =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(2400);
  });
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});
async function start(source: ReturnType<typeof createMockHomeJourney>) {
  await nativeRender(
    <SafeAreaInsetsContext.Provider
      value={{ top: 28, bottom: 24, left: 0, right: 0 }}
    >
      <HomeNightJourney source={source} onExit={() => {}} />
    </SafeAreaInsetsContext.Provider>,
  );
  await tick();
  await press('오늘 밤 양 세러 가기');
  await tick();
  await fireEvent.press(screen.getByRole('radio', { name: '취업' }));
  await fireEvent.changeText(
    screen.getByLabelText('오늘의 고민'),
    '면접이 걱정돼요',
  );
  await press('다음');
  await tick();
  await press('양 세기 시작');
  await tick();
  await press('다음 양');
  await tick();
  await press('다음 양');
  await tick();
  await press('마무리하기');
  await tick();
  await press('다음');
}
it.each([
  ['text', false],
  ['text', true],
  ['song', false],
  ['song', true],
] as const)(
  'shares a %s card written at night or morning with the home list; receipt lost=%s',
  async (kind, lost) => {
    const source = createMockHomeJourney(
      lost ? 'writing-lost-response' : 'success',
    );
    await start(source);
    if (kind === 'text') {
      await press('지금 쓸래요');
      await tick();
    } else {
      await press('아침에 쓸게요');
      await tick();
      await press('밤 마무리 확인');
      await press('다음 아침으로 이동');
      await tick();
      await tick();
      await press('이 양 데려오기');
      await tick();
      await press('미뤄 둔 카드 쓰기');
    }
    await fireEvent.press(screen.getByRole('radio', { name: '취업' }));
    if (kind === 'song')
      await fireEvent.press(screen.getByRole('radio', { name: '노래 추천' }));
    await press('다음');
    if (kind === 'text')
      await fireEvent.changeText(
        screen.getByLabelText('짧은 글'),
        '밤에 맡긴 내 경험',
      );
    else {
      await fireEvent.changeText(
        screen.getByLabelText('곡 이름 또는 가수 검색'),
        '밤편지',
      );
      await tick();
      await fireEvent.press(
        screen.getByRole('radio', { name: '밤편지 · 아이유' }),
      );
      await fireEvent.changeText(
        screen.getByLabelText('추천 한 줄'),
        '아침에 맡긴 내 노래',
      );
    }
    await press('검수 요청하기');
    await tick();
    if (lost) {
      expect(screen.getByText('접수를 확인하지 못했어요')).toBeTruthy();
      const label = kind === 'text' ? '짧은 글' : '추천 한 줄';
      await fireEvent.changeText(
        screen.getByLabelText(label),
        '응답 유실 뒤 편집',
      );
      await press('이전');
      await press('이전');
      await press(kind === 'text' ? '카드 이어 쓰기' : '미뤄 둔 카드 쓰기');
      expect(screen.getByLabelText(label)).toHaveDisplayValue(
        '응답 유실 뒤 편집',
      );
      await press('이전 접수 확인');
      await tick();
    }
    expect(screen.getByText('카드를 맡겼어요')).toBeTruthy();
    await press(kind === 'text' ? '이제 잘게요' : '아침 홈으로');
    await tick();
    if (kind === 'text') {
      await press('홈으로 돌아가기');
      await tick();
      await tick();
    }
    await press('내 카드 열기');
    await tick();
    const content = kind === 'text' ? '밤에 맡긴 내 경험' : '밤편지 · 아이유';
    expect(screen.getByText(content)).toBeTruthy();
    await fireEvent.press(screen.getByRole('tab', { name: '검수 중' }));
    await tick();
    expect(screen.getAllByText(content)).toHaveLength(1);
    const pending = source.home.cards!.load(
      { status: 'pending' },
      new AbortController().signal,
    );
    await tick();
    const items = (await pending).items;
    expect(items).toHaveLength(1);
    expect(items[0].content).toMatchObject(
      kind === 'text'
        ? { text: '밤에 맡긴 내 경험' }
        : { recommendation: '아침에 맡긴 내 노래' },
    );
    await press(
      kind === 'text'
        ? '카드 삭제: 밤에 맡긴 내 경험'
        : '카드 삭제: 밤편지 · 아이유',
    );
    await press('지우기');
    await tick();
    expect(screen.queryByText(content)).toBeNull();
    await press('홈으로 돌아가기');
    await press('내 카드 열기');
    await tick();
    expect(screen.queryByText(content)).toBeNull();
    expect(screen.getByText('아직 쓴 카드가 없어요')).toBeTruthy();
  },
);

it('cancels the previous account card query and ignores a late result after the home source changes', async () => {
  const a = createMockHomeJourney(),
    b = createMockHomeJourney();
  const signal = new AbortController().signal;
  const writer = a.home.cards!.createWritingSession();
  const receipt = writer.text.submit(
    {
      kind: 'text',
      category_id: 'career',
      content: { text: '이전 계정 카드' },
    },
    'old',
    signal,
  );
  await tick();
  await receipt;
  const oldLoad = a.home.cards!.load({}, signal);
  await tick();
  const oldPage = await oldLoad;
  const late = deferred<SubmissionPage>();
  const load = jest
    .spyOn(a.home.cards!, 'load')
    .mockImplementation(() => late.promise);
  const ui = (source: typeof a) => (
    <SafeAreaInsetsContext.Provider
      value={{ top: 28, bottom: 24, left: 0, right: 0 }}
    >
      <HomeNightJourney source={source} onExit={() => {}} />
    </SafeAreaInsetsContext.Provider>
  );
  await nativeRender(ui(a));
  await tick();
  await press('내 카드 열기');
  await screen.rerender(ui(b));
  await tick();
  expect(load.mock.calls[0][1].aborted).toBe(true);
  await act(async () => late.resolve(oldPage));
  await press('내 카드 열기');
  await tick();
  expect(screen.queryByText('이전 계정 카드')).toBeNull();
  expect(screen.getByText('아직 쓴 카드가 없어요')).toBeTruthy();
});

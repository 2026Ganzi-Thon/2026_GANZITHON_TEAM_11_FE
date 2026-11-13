import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, BackHandler } from 'react-native';
import { NightMorningFlow } from './NightMorningFlow';
import { createNightMorningDemo } from '../../mocks/nightMorningDemo';
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
const tick = () =>
  act(async () => {
    await jest.runAllTimersAsync();
  });
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});
async function start(noWorry = false) {
  jest.useFakeTimers();
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
  await fireEvent.press(
    screen.getByRole('radio', { name: noWorry ? '고민 없음' : '취업' }),
  );
  if (!noWorry)
    await fireEvent.changeText(
      screen.getByLabelText('오늘의 고민'),
      '시연에서 입력한 고민',
    );
  await press('다음');
  await tick();
  await press('양 세기 시작');
  await tick();
  await tick();
}
async function rest() {
  await press('다음');
  await press('아침에 쓸게요');
  await tick();
  await press('밤 마무리 확인');
  await press('다음 아침으로 이동');
  await tick();
}
describe('night to morning demo', () => {
  it('finishes three sheep, adopts the displayed card, writes reflection and shows the same worry and answer in detail', async () => {
    const demo = createNightMorningDemo();
    await render(<NightMorningFlow demo={demo} onExit={() => {}} />);
    await start();
    expect(screen.getByText('1 / 3')).toBeTruthy();
    await press('다음 양');
    await press('다음 양');
    await press('마무리하기');
    await tick();
    expect(screen.getByText('3마리 다 셌어요')).toBeTruthy();
    await rest();
    expect(screen.getByText(/어젯밤 양 3마리/)).toBeTruthy();
    await press('이 양 데려오기');
    await tick();
    await tick();
    await press('어젯밤 돌아보기');
    await tick();
    expect(screen.getByText('시연에서 입력한 고민')).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: '작아졌어요' }));
    await press('회고 저장하기');
    await tick();
    await press('양떼 보러 가기');
    await press('2026-11-12의 양 · 새로 온 양');
    await tick();
    expect(screen.getByText('시연에서 입력한 고민')).toBeTruthy();
    expect(screen.getByText('봐, 밤엔 커 보였던 거야.')).toBeTruthy();
    expect(
      screen.getByText('오늘 하루도 버틴 너, 이제 눈 감아도 괜찮아.'),
    ).toBeTruthy();
  });
  it('pauses on back, resumes the same position and finishes early without counting unseen cards', async () => {
    let back: (() => boolean | null | undefined) | undefined;
    jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((_event, callback) => {
        back = () => callback({} as Parameters<typeof callback>[0]);
        return { remove: () => {} };
      });
    const demo = createNightMorningDemo();
    await render(<NightMorningFlow demo={demo} onExit={() => {}} />);
    await start(true);
    await press('다음 양');
    await act(async () => {
      back?.();
    });
    expect(screen.getByText('시연을 잠깐 멈췄어요')).toBeTruthy();
    await press('이어 보기');
    await tick();
    expect(screen.getByText('2 / 3')).toBeTruthy();
    await press('그만 세고 싶어요');
    await tick();
    await press('다음');
    await tick();
    expect(screen.getByText('오늘은 2마리까지 셌어요')).toBeTruthy();
    await rest();
    expect(screen.getByText(/어젯밤 양 2마리/)).toBeTruthy();
    await press('이 양 데려오기');
    await tick();
    await tick();
    await press('어젯밤 돌아보기');
    await tick();
    expect(screen.getByText('고민 없이 쉬어 간 밤이에요.')).toBeTruthy();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });
  it('retries lost finish and adoption responses in the connected UI', async () => {
    const demo = createNightMorningDemo('lost-responses');
    await render(<NightMorningFlow demo={demo} onExit={() => {}} />);
    await start();
    await press('다음 양');
    await press('다음 양');
    await press('마무리하기');
    await tick();
    expect(screen.getByText('마무리를 준비하지 못했어요')).toBeTruthy();
    await press('다시 시도');
    await tick();
    expect(screen.getByText('3마리 다 셌어요')).toBeTruthy();
    await rest();
    await press('이 양 데려오기');
    await tick();
    expect(screen.getByText(/양을 데려오지 못했어요/)).toBeTruthy();
    await press('이 양 데려오기');
    await tick();
    await tick();
    expect(
      screen.getAllByRole('button', { name: /2026-11-12의 양/ }),
    ).toHaveLength(1);
  });
  it('reopens an interrupted closing without resetting the completed count', async () => {
    const demo = createNightMorningDemo();
    await render(<NightMorningFlow demo={demo} onExit={() => {}} />);
    await start();
    await press('그만 세고 싶어요');
    await tick();
    await press('미리보기 나가기');
    expect(screen.getByText('시연을 잠깐 멈췄어요')).toBeTruthy();
    await press('이어 보기');
    await tick();
    await press('다음');
    await tick();
    expect(screen.getByText('오늘은 1마리까지 셌어요')).toBeTruthy();
  });
  it('retains yarn through draft close/resume and excludes the pending submission from morning', async () => {
    const demo = createNightMorningDemo();
    const submit = jest.spyOn(demo.textCards, 'submit');
    await render(<NightMorningFlow demo={demo} onExit={() => {}} />);
    await start();
    await press('털실 보내기');
    await tick();
    await press('다음 양');
    await press('이전 양');
    expect(
      screen.getByRole('button', { name: '털실 보내기 취소' }),
    ).toBeSelected();
    await press('다음 양');
    await press('다음 양');
    await press('마무리하기');
    await tick();
    await press('다음');
    await press('지금 쓸래요');
    await tick();
    await fireEvent.press(screen.getByRole('radio', { name: '학업' }));
    await press('다음');
    await fireEvent.changeText(
      screen.getByLabelText('짧은 글'),
      '천천히 쉬어 가도 괜찮아요.',
    );
    await press('이전');
    await fireEvent(screen.getByTestId('card-writing-modal'), 'requestClose');
    expect(screen.getByText('초안을 잠깐 접어뒀어요')).toBeTruthy();
    await press('카드 이어 쓰기');
    expect(screen.getByDisplayValue('천천히 쉬어 가도 괜찮아요.')).toBeTruthy();
    await press('검수 요청하기');
    await tick();
    expect(submit.mock.calls[0][0].source_night_id).toBe(demo.nightId);
    expect(screen.getByText('카드를 맡겼어요')).toBeTruthy();
    await fireEvent(screen.getByTestId('text-card-modal'), 'requestClose');
    expect(screen.getByText('밤 마무리를 확인했어요')).toBeTruthy();
    await press('다음 아침으로 이동');
    await tick();
    expect(screen.getByText(/어젯밤 양 3마리/)).toBeTruthy();
    expect(screen.queryByText('천천히 쉬어 가도 괜찮아요.')).toBeNull();
    await act(async () => {
      const result = demo.morning.loadMorning(new AbortController().signal);
      await jest.runAllTimersAsync();
      const morning = await result;
      expect(morning.candidate_cards.map((item) => item.card.id)).toEqual([
        'preview-card-3',
        'preview-card-2',
        'preview-card-1',
      ]);
      expect(
        morning.candidate_cards.find(
          (item) => item.card.id === 'preview-card-1',
        )?.card.viewer.yarn_sent,
      ).toBe(true);
    });
  });
  it('lets an unfinished writer close and defer without submitting the draft', async () => {
    const demo = createNightMorningDemo();
    const submit = jest.spyOn(demo.textCards, 'submit');
    await render(<NightMorningFlow demo={demo} onExit={() => {}} />);
    await start();
    await press('다음 양');
    await press('다음 양');
    await press('마무리하기');
    await tick();
    await press('다음');
    await press('지금 쓸래요');
    await tick();
    await press('이전');
    await press('아침에 쓸게요');
    await tick();
    await press('밤 마무리 확인');
    expect(screen.getByText('밤 마무리를 확인했어요')).toBeTruthy();
    expect(submit).not.toHaveBeenCalled();
  });
});

it('offers a song card after the night writing offer', async () => {
  const demo = createNightMorningDemo();
  await render(<NightMorningFlow demo={demo} onExit={() => {}} />);
  await start();
  await press('다음 양');
  await press('다음 양');
  await press('마무리하기');
  await tick();
  await press('다음');
  await press('지금 쓸래요');
  await tick();
  expect(screen.getByRole('radio', { name: '노래 추천' })).toBeTruthy();
});
it('submits a song using the night offer and leaves the pending recommendation out of morning candidates', async () => {
  const demo = createNightMorningDemo(),
    submit = jest.spyOn(demo.songCards, 'submit');
  await render(<NightMorningFlow demo={demo} onExit={() => {}} />);
  await start();
  await press('다음 양');
  await press('다음 양');
  await press('마무리하기');
  await tick();
  await press('다음');
  await press('지금 쓸래요');
  await tick();
  await fireEvent.press(screen.getByRole('radio', { name: '학업' }));
  await fireEvent.press(screen.getByRole('radio', { name: '노래 추천' }));
  await press('다음');
  await fireEvent.changeText(
    screen.getByLabelText('곡 이름 또는 가수 검색'),
    '밤편지',
  );
  await tick();
  await fireEvent.press(screen.getByRole('radio', { name: '밤편지 · 아이유' }));
  await fireEvent.changeText(
    screen.getByLabelText('추천 한 줄'),
    '밤에 기대기 좋은 노래',
  );
  await press('이전');
  await fireEvent(screen.getByTestId('card-writing-modal'), 'requestClose');
  await press('카드 이어 쓰기');
  expect(screen.getByDisplayValue('밤에 기대기 좋은 노래')).toBeTruthy();
  await press('검수 요청하기');
  await tick();
  expect(submit.mock.calls[0][0].source_night_id).toBe(demo.nightId);
  expect(screen.getByText('카드를 맡겼어요')).toBeTruthy();
  await press('이제 잘게요');
  await press('다음 아침으로 이동');
  await tick();
  await act(async () => {
    const result = demo.morning.loadMorning(new AbortController().signal);
    await jest.runAllTimersAsync();
    const morning = await result;
    expect(morning.candidate_cards.map((c) => c.card.id)).toEqual([
      'preview-card-3',
      'preview-card-2',
      'preview-card-1',
    ]);
  });
  expect(screen.queryByText('밤에 기대기 좋은 노래')).toBeNull();
});

import { afterEach, expect, it, jest } from '@jest/globals';
import {
  act,
  fireEvent,
  render as renderNative,
  screen,
} from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { HomeFlow } from './HomeFlow';
import type { HomeSource } from './types';
import type { MorningActions, Sheep } from '../morning/types';
const sheep: Sheep = {
  id: 'sheep-1',
  night_id: 'night-1',
  night_date: '2026-11-14',
  card_id: 'c1',
  color_key: 'career',
};
function source(nights = 0): HomeSource {
  const morning: MorningActions = {
    loadMorning: jest.fn<MorningActions['loadMorning']>().mockResolvedValue({
      night: null,
      counted_sheep: null,
      candidate_cards: [],
      default_card_id: null,
      adoption: null,
    }),
    loadFlock: jest.fn<MorningActions['loadFlock']>().mockResolvedValue([]),
    adopt: jest.fn<MorningActions['adopt']>().mockResolvedValue(sheep),
  };
  return {
    clock: {
      load: jest.fn<HomeSource['clock']['load']>().mockResolvedValue({
        server_time: '2026-11-15T12:00:00+09:00',
        timezone: 'Asia/Seoul',
        phase: 'day',
        user: { id: 'user', stats: { night_count: nights } },
      }),
    },
    morning,
    fortune: {
      load: jest.fn<HomeSource['fortune']['load']>().mockResolvedValue({
        date: '2026-11-15',
        zodiac: 'taurus',
        rank: 3,
        sheep_type: 'sparkling',
        message: '오늘도 잠깐 쉬어가요',
        lucky_color: '연두',
        lucky_item: '손수건',
        small_action: '천천히 걸어봐요',
      }),
    },
  };
}
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
const render = (ui: ReactElement) =>
  renderNative(
    <SafeAreaInsetsContext.Provider
      value={{ top: 28, bottom: 24, left: 0, right: 0 }}
    >
      {ui}
    </SafeAreaInsetsContext.Provider>,
  );
afterEach(() => {
  jest.restoreAllMocks();
});
it('uses confirmed zero nights to show D-02c and does not query or open adoption, flock or yarn summaries', async () => {
  const data = source();
  const summaryLoad = jest
    .fn<NonNullable<MorningActions['receivedYarn']>['load']>()
    .mockResolvedValue({
      id: 'summary',
      date: '2026-11-15',
      yarn_count: 1,
      sender_count: 1,
    });
  data.morning.receivedYarn = {
    load: summaryLoad,
    markSeen: jest
      .fn<NonNullable<MorningActions['receivedYarn']>['markSeen']>()
      .mockResolvedValue(undefined),
  };
  await render(<HomeFlow source={data} onNight={() => {}} onExit={() => {}} />);
  expect(screen.getByText('아직 센 양이 없어요')).toBeTruthy();
  expect(screen.getByLabelText('센 밤 수')).toHaveTextContent('0밤');
  expect(screen.getByText('오늘 밤 첫 양을 데려와 줘!')).toBeTruthy();
  expect(screen.getByRole('button', { name: '오늘의 운세 보기' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: '이 양 데려오기' })).toBeNull();
  expect(screen.queryByRole('button', { name: '담은 노래 보기' })).toBeNull();
  expect(data.morning.loadMorning).not.toHaveBeenCalled();
  expect(data.morning.loadFlock).not.toHaveBeenCalled();
  expect(summaryLoad).not.toHaveBeenCalled();
  expect(
    screen.getByRole('button', { name: '밤 9시에 열려요' }),
  ).toBeDisabled();
});
it('does not misclassify an empty flock after a counted night as D-02c and supplies the same home footer', async () => {
  const data = source(1);
  await render(<HomeFlow source={data} onNight={() => {}} onExit={() => {}} />);
  expect(await screen.findByText('아직 양떼가 비어 있어요')).toBeTruthy();
  expect(screen.queryByText('아직 센 양이 없어요')).toBeNull();
  expect(data.morning.loadFlock).toHaveBeenCalledTimes(1);
  expect(
    screen.getByRole('button', { name: '밤 9시에 열려요' }),
  ).toBeDisabled();
});
it('leaves an unadopted candidate in D-01 and adds the shared footer only after adoption', async () => {
  const data = source(1);
  data.morning.loadMorning = jest
    .fn<MorningActions['loadMorning']>()
    .mockResolvedValue({
      night: { id: 'night-1', night_date: '2026-11-14' },
      counted_sheep: 3,
      adoption: null,
      default_card_id: 'c1',
      candidate_cards: [
        {
          card: {
            id: 'c1',
            kind: 'text',
            tone: 'warm',
            category_id: 'career',
            author_type: 'seed',
            author_label: '예시 양',
            available: true,
            viewer: { yarn_sent: false, fluff_saved: false, song_saved: false },
            content: { text: '수고했어' },
          },
          can_adopt: true,
          fluff_saved: false,
          position: 3,
          sheep_count: 3,
          last_viewed_at: '2026-11-14T18:00:00Z',
        },
      ],
    });
  await render(<HomeFlow source={data} onNight={() => {}} onExit={() => {}} />);
  expect(screen.getByRole('button', { name: '이 양 데려오기' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: '밤 9시에 열려요' })).toBeNull();
  await press('이 양 데려오기');
  expect(screen.getByRole('button', { name: '밤 9시에 열려요' })).toBeTruthy();
  expect(data.morning.adopt).toHaveBeenCalledTimes(1);
});
it('never renders zero nights from a slow or failed context query and can recover', async () => {
  const data = source();
  data.clock.load = jest
    .fn<HomeSource['clock']['load']>()
    .mockRejectedValueOnce(new Error('private'))
    .mockResolvedValue({
      server_time: '2026-11-15T12:00:00+09:00',
      timezone: 'Asia/Seoul',
      phase: 'day',
      user: { id: 'user', stats: { night_count: 0 } },
    });
  await render(<HomeFlow source={data} onNight={() => {}} onExit={() => {}} />);
  expect(screen.queryByText('아직 센 양이 없어요')).toBeNull();
  expect(screen.queryByText('private')).toBeNull();
  await press('홈 상태 다시 확인');
  expect(screen.getByText('아직 센 양이 없어요')).toBeTruthy();
});
it('waits for actual statistics and leaves D-02c after a later confirmed counted night', async () => {
  const data = source();
  let resolve!: (
    value: Awaited<ReturnType<HomeSource['clock']['load']>>,
  ) => void;
  const load = jest
    .fn<HomeSource['clock']['load']>()
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    )
    .mockResolvedValue({
      server_time: '2026-11-15T12:00:00+09:00',
      timezone: 'Asia/Seoul',
      phase: 'day',
      user: { id: 'user', stats: { night_count: 1 } },
    });
  data.clock = { load };
  await render(<HomeFlow source={data} onNight={() => {}} onExit={() => {}} />);
  expect(screen.queryByText('아직 센 양이 없어요')).toBeNull();
  expect(data.morning.loadMorning).not.toHaveBeenCalled();
  await act(async () =>
    resolve({
      server_time: '2026-11-15T21:00:00+09:00',
      timezone: 'Asia/Seoul',
      phase: 'night',
      user: { id: 'user', stats: { night_count: 0 } },
    }),
  );
  expect(screen.getByText('아직 센 양이 없어요')).toBeTruthy();
  await press('오늘 밤 양 세러 가기');
  expect(await screen.findByText('아직 양떼가 비어 있어요')).toBeTruthy();
  expect(screen.queryByText('아직 센 양이 없어요')).toBeNull();
});
it('keeps the first-night home usable when fortune fails and blocks the footer only while its popup is open', async () => {
  const data = source(),
    open = jest.fn();
  data.clock.load = jest.fn<HomeSource['clock']['load']>().mockResolvedValue({
    server_time: '2026-11-15T21:00:00+09:00',
    timezone: 'Asia/Seoul',
    phase: 'night',
    user: { id: 'user', stats: { night_count: 0 } },
  });
  data.fortune.load = jest
    .fn<HomeSource['fortune']['load']>()
    .mockRejectedValue(new Error('private'));
  await render(<HomeFlow source={data} onNight={open} onExit={() => {}} />);
  expect(
    screen.getByRole('button', { name: '오늘 밤 양 세러 가기' }),
  ).toBeEnabled();
  await press('오늘의 운세 보기');
  expect(
    screen.getByRole('button', { name: '운세 다시 불러오기' }),
  ).toBeTruthy();
  await press('오늘의 운세 닫기');
  expect(
    screen.getByRole('button', { name: '오늘 밤 양 세러 가기' }),
  ).toBeEnabled();
  await press('오늘 밤 양 세러 가기');
  expect(open).toHaveBeenCalledTimes(1);
});

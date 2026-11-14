import { AppState } from 'react-native';
import { createMockReceivedYarn } from '../../mocks/receivedYarn';
import { createMockSettings } from '../../mocks/settings';
import { expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { MorningScreen } from '../morning/MorningScreen';
import type { SettingsActions } from './types';
import { createMockMorning } from '../../mocks/morning';
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
it('opens settings and paginated worry records from home without exposing deletion or changing the flock', async () => {
  const base = createMockMorning('existing');
  const loadMe = jest.fn<SettingsActions['loadMe']>().mockResolvedValue({
    user: {
      id: 'u',
      email: 'user@example.com',
      birth_date: '2004-05-14',
      birth_date_edits_remaining: 1,
      stats: {
        night_count: 66,
        counted_sheep_total: 658,
        worry_record_count: 3,
      },
    },
    reminder: { enabled: false, local_time: null },
  });
  const load = jest
    .fn<SettingsActions['worries']['load']>()
    .mockResolvedValueOnce({
      items: [
        {
          night_id: 'n1',
          night_date: '2026-11-07',
          category_id: 'career',
          worry_text: '면접이 걱정돼요.',
          reflection: { answer: 'same', message: '함께 쉬자.' },
        },
      ],
      next_cursor: 'next',
    })
    .mockResolvedValueOnce({
      items: [
        {
          night_id: 'n2',
          night_date: '2026-11-06',
          category_id: 'romance',
          worry_text: '연락을 기다려요.',
          reflection: null,
        },
        {
          night_id: 'n3',
          night_date: '2026-11-05',
          category_id: 'study',
          worry_text: '시험이 걱정돼요.',
          reflection: null,
        },
      ],
      next_cursor: null,
    });
  const source = { ...base, settings: { loadMe, worries: { load } } };
  await render(
    <MorningScreen
      actions={source}
      loadDetail={source.loadSheep}
      onExit={() => {}}
    />,
  );
  await screen.findByText('나의 양떼');
  await press('설정 열기');
  expect(await screen.findByText('66밤째 양을 세는 중')).toBeTruthy();
  expect(screen.getByText('user@example.com')).toBeTruthy();
  await press('고민 기록 열기');
  expect(await screen.findByText('면접이 걱정돼요.')).toBeTruthy();
  expect(screen.getByText('고민 기록 3개')).toBeTruthy();
  expect(screen.getByText('아침에 돌아본 답 · 그대로예요')).toBeTruthy();
  expect(load).toHaveBeenNthCalledWith(1, {}, expect.any(AbortSignal));
  expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  expect(
    screen.queryByRole('button', { name: /지우기|삭제|전체 선택/ }),
  ).toBeNull();
  await press('더 보기');
  expect(await screen.findByText('시험이 걱정돼요.')).toBeTruthy();
  expect(load).toHaveBeenNthCalledWith(
    2,
    { cursor: 'next' },
    expect.any(AbortSignal),
  );
  expect(screen.queryByRole('button', { name: '더 보기' })).toBeNull();
  await press('설정으로 돌아가기');
  await press('아침 홈으로 돌아가기');
  expect(screen.getByRole('button', { name: '2026-11-10의 양' })).toBeTruthy();
});
it('queues a late yarn summary until settings closes without acknowledging an obscured popup', async () => {
  jest.useFakeTimers();
  const originalState = Object.getOwnPropertyDescriptor(
    AppState,
    'currentState',
  );
  Object.defineProperty(AppState, 'currentState', {
    value: 'active',
    configurable: true,
  });
  try {
    const base = createMockMorning('existing');
    const receivedYarn = createMockReceivedYarn('slow-load');
    const seen = jest.spyOn(receivedYarn, 'markSeen');
    const source = { ...base, receivedYarn, settings: createMockSettings() };
    await render(<MorningScreen actions={source} onExit={() => {}} />);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1500);
    });
    await press('설정 열기');
    await act(async () => {
      await jest.runAllTimersAsync();
    });
    expect(screen.getByRole('button', { name: '고민 기록 열기' })).toBeTruthy();
    expect(
      screen.queryByTestId('received-yarn-modal', {
        includeHiddenElements: true,
      }),
    ).toBeNull();
    expect(seen).not.toHaveBeenCalled();
    await press('아침 홈으로 돌아가기');
    await act(async () => {
      await jest.runAllTimersAsync();
    });
    expect(screen.getByText('털실 3개가 도착했어요')).toBeTruthy();
    await fireEvent(screen.getByTestId('received-yarn-modal'), 'show');
    await act(async () => {
      await jest.runAllTimersAsync();
    });
    expect(seen).toHaveBeenCalledTimes(1);
  } finally {
    if (originalState)
      Object.defineProperty(AppState, 'currentState', originalState);
    jest.useRealTimers();
  }
});

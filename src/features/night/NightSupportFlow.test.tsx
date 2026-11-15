import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Linking, Platform } from 'react-native';
import type { Support } from '../../api/contracts';
import { NightEntryScreen } from './NightEntryScreen';
import type { NightEntryActions } from './entry';
const support: Support = {
  message: '도움 안내 예시',
  resources: [
    { label: '연락처 앱 열기', action: 'open_contacts', target: null },
  ],
};
function actions() {
  return {
    checkWorry: jest
      .fn<NightEntryActions['checkWorry']>()
      .mockResolvedValue({ id: 'night-1', status: 'needs_support', support }),
    continueSupport: jest
      .fn<NightEntryActions['continueSupport']>()
      .mockResolvedValue({ id: 'night-1', active_session_id: null }),
    startCounting: jest
      .fn<NightEntryActions['startCounting']>()
      .mockResolvedValue(undefined),
  };
}
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
async function fill() {
  await fireEvent.press(screen.getByRole('radio', { name: '취업' }));
  await fireEvent.changeText(
    screen.getByLabelText('오늘의 고민'),
    '면접이 걱정돼요',
  );
  await press('다음');
}
afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});
it('uses the response branch and requires successful continue before showing count; external launch and back retain the worry', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const api = actions(),
    open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  await render(<NightEntryScreen actions={api} onBack={() => {}} />);
  await fill();
  expect(screen.getByText('도움 안내 예시')).toBeTruthy();
  expect(screen.queryByText('오늘은 몇 마리 셀까요?')).toBeNull();
  await press('연락처 앱 열기');
  expect(open).toHaveBeenCalledTimes(1);
  expect(api.continueSupport).not.toHaveBeenCalled();
  await press('뒤로');
  expect(screen.getByLabelText('오늘의 고민')).toHaveDisplayValue(
    '면접이 걱정돼요',
  );
  expect(screen.getByRole('radio', { name: '취업' })).toBeSelected();
  await press('다음');
  await press('계속하기');
  expect(api.continueSupport).toHaveBeenCalledWith(
    'night-1',
    expect.any(AbortSignal),
  );
  expect(screen.getByText('오늘은 몇 마리 셀까요?')).toBeTruthy();
  expect(api.startCounting).not.toHaveBeenCalled();
});
it('keeps failed continue on the help screen, prevents duplicate requests, and starts only on an explicit later count action', async () => {
  const api = actions();
  let reject!: (e: Error) => void;
  api.continueSupport.mockImplementationOnce(
    () =>
      new Promise((_, r) => {
        reject = r;
      }),
  );
  await render(<NightEntryScreen actions={api} onBack={() => {}} />);
  await fill();
  await press('계속하기');
  await press('계속하는 중');
  expect(api.continueSupport).toHaveBeenCalledTimes(1);
  await act(async () => reject(new Error('private detail')));
  expect(screen.getByRole('alert')).toHaveTextContent(
    /계속하기 응답을 확인하지 못했어요/,
  );
  expect(screen.queryByText('private detail')).toBeNull();
  expect(screen.queryByText('오늘은 몇 마리 셀까요?')).toBeNull();
  await press('계속하기');
  expect(api.continueSupport).toHaveBeenCalledTimes(2);
  await press('양 세기 시작');
  expect(api.startCounting).toHaveBeenCalledTimes(1);
});
it('does not bypass missing support; reloads the frozen submitted worry and requires valid help before continuing', async () => {
  const api = actions();
  api.checkWorry.mockResolvedValueOnce({
    id: 'night-1',
    status: 'needs_support',
    support: null,
  });
  await render(<NightEntryScreen actions={api} onBack={() => {}} />);
  await fill();
  expect(screen.getByRole('button', { name: '계속하기' })).toBeDisabled();
  await press('도움 안내 다시 불러오기');
  expect(api.checkWorry.mock.calls[1][0]).toEqual({
    category_id: 'career',
    worry_text: '면접이 걱정돼요',
  });
  expect(screen.getByText('도움 안내 예시')).toBeTruthy();
  expect(api.continueSupport).not.toHaveBeenCalled();
  await press('계속하기');
  expect(screen.getByText('오늘은 몇 마리 셀까요?')).toBeTruthy();
});
it.each([
  { id: 'other-night', active_session_id: null },
  { id: 'night-1', active_session_id: 'existing-session' },
  undefined,
])(
  'does not start a new count from an invalid or existing-session continue result (%p)',
  async (result) => {
    const api = actions();
    api.continueSupport.mockResolvedValue(result as never);
    await render(<NightEntryScreen actions={api} onBack={() => {}} />);
    await fill();
    await press('계속하기');
    expect(screen.getByRole('alert')).toHaveTextContent(
      /계속하기 응답을 확인하지 못했어요/,
    );
    expect(screen.queryByText('오늘은 몇 마리 셀까요?')).toBeNull();
    expect(api.startCounting).not.toHaveBeenCalled();
  },
);
it('aborts a pending continue on back and ignores its late success without losing the worry', async () => {
  const api = actions();
  let resolve!: (value: { id: string; active_session_id: null }) => void;
  api.continueSupport.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  await render(<NightEntryScreen actions={api} onBack={() => {}} />);
  await fill();
  await press('계속하기');
  const signal = api.continueSupport.mock.calls[0][1];
  await press('뒤로');
  expect(signal.aborted).toBe(true);
  await act(async () => resolve({ id: 'night-1', active_session_id: null }));
  expect(screen.getByLabelText('오늘의 고민')).toHaveDisplayValue(
    '면접이 걱정돼요',
  );
  expect(screen.queryByText('오늘은 몇 마리 셀까요?')).toBeNull();
});
it('isolates a new source, aborting the old continue and ignoring its late result', async () => {
  const old = actions(),
    next = actions();
  let resolve!: (value: { id: string; active_session_id: null }) => void;
  old.continueSupport.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const view = await render(
    <NightEntryScreen actions={old} onBack={() => {}} />,
  );
  await fill();
  await press('계속하기');
  await view.rerender(<NightEntryScreen actions={next} onBack={() => {}} />);
  expect(old.continueSupport.mock.calls[0][1].aborted).toBe(true);
  await act(async () => resolve({ id: 'night-1', active_session_id: null }));
  expect(screen.getByLabelText('오늘의 고민')).toHaveDisplayValue('');
  expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
  expect(next.startCounting).not.toHaveBeenCalled();
});
it.each([
  undefined,
  { id: '', status: 'ready', support: null },
  { id: 'night-1', status: 'closed', support: null },
  { id: 'night-1', status: 'ready', support },
])(
  'keeps the worry when the initial result cannot safely select a branch (%p)',
  async (result) => {
    const api = actions();
    api.checkWorry.mockResolvedValue(result as never);
    await render(<NightEntryScreen actions={api} onBack={() => {}} />);
    await fill();
    expect(screen.getByLabelText('오늘의 고민')).toHaveDisplayValue(
      '면접이 걱정돼요',
    );
    expect(screen.queryByText('오늘은 몇 마리 셀까요?')).toBeNull();
    expect(api.continueSupport).not.toHaveBeenCalled();
  },
);
it('keeps missing support blocked through reload failure and a mismatched night, then recovers on explicit retry', async () => {
  const api = actions();
  api.checkWorry
    .mockResolvedValueOnce({
      id: 'night-1',
      status: 'needs_support',
      support: null,
    })
    .mockRejectedValueOnce(new Error('private reload details'))
    .mockResolvedValueOnce({
      id: 'other-night',
      status: 'needs_support',
      support,
    });
  await render(<NightEntryScreen actions={api} onBack={() => {}} />);
  await fill();
  await press('도움 안내 다시 불러오기');
  expect(
    screen.getByText('도움 안내를 다시 불러오지 못했어요. 다시 시도해 주세요.'),
  ).toBeTruthy();
  expect(screen.getByRole('button', { name: '계속하기' })).toBeDisabled();
  await press('도움 안내 다시 불러오기');
  expect(screen.getByRole('button', { name: '계속하기' })).toBeDisabled();
  await press('도움 안내 다시 불러오기');
  expect(screen.getByRole('button', { name: '계속하기' })).toBeEnabled();
  for (const [body] of api.checkWorry.mock.calls)
    expect(body).toEqual({
      category_id: 'career',
      worry_text: '면접이 걱정돼요',
    });
  await press('뒤로');
  expect(screen.getByLabelText('오늘의 고민')).toHaveDisplayValue(
    '면접이 걱정돼요',
  );
});

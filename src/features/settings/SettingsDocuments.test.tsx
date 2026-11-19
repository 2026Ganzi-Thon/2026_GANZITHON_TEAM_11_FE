import { afterEach, expect, it, jest } from '@jest/globals';
import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';
import { SettingsScreen } from './SettingsScreen';
import type { SettingsActions } from './types';
import { createMockSignup } from '../../mocks/signup';
import { createMockSettings } from '../../mocks/settings';
import { deferred } from '../../notifications/__tests__/fakeDevice';
import type { ConsentDocuments } from '../signup/types';
const docs: ConsentDocuments = {
  revision: 'r1',
  documents: [
    { id: 'terms', title: '서비스 이용약관', version: 'v1', body: '약관 본문' },
    {
      id: 'privacy',
      title: '개인정보 수집 · 이용',
      version: 'v1',
      body: '개인정보 본문',
    },
    {
      id: 'processing',
      title: '고민 글 외부 AI 전송',
      version: 'v1',
      body: '처리 안내',
    },
    {
      id: 'notifications',
      title: '알림 수신',
      version: 'v1',
      body: '알림 안내',
    },
  ],
};
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
function source(email = 'member@example.com'): SettingsActions {
  return {
    loadMe: async () => ({
      user: {
        id: email,
        email,
        birth_date: null,
        birth_date_edits_remaining: 1,
        stats: {
          night_count: 0,
          counted_sheep_total: 0,
          worry_record_count: 0,
        },
      },
      reminder: { enabled: false, local_time: null },
    }),
    worries: { load: async () => ({ items: [], next_cursor: null }) },
    documents: { load: async () => docs },
  };
}
afterEach(() => {
  jest.useRealTimers();
});
it('shows login email as readable information and opens the same versioned documents without consenting', async () => {
  const actions = source();
  await render(<SettingsScreen modal actions={actions} onBack={() => {}} />);
  expect(screen.getByLabelText('로그인 정보: member@example.com')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /로그인 정보/ })).toBeNull();
  await press('약관 · 개인정보 열기');
  await press('개인정보 수집 · 이용 보기');
  expect(screen.getByText('개인정보 본문')).toBeTruthy();
  expect(
    within(screen.getByTestId('legal-document-modal')).getByText(
      '문서 버전 · v1',
    ),
  ).toBeTruthy();
  await fireEvent(screen.getByTestId('legal-document-modal'), 'requestClose');
  expect(screen.queryByText('개인정보 본문')).toBeNull();
  expect(
    screen.getByRole('button', { name: '서비스 이용약관 보기' }),
  ).toBeTruthy();
  await fireEvent(screen.getByTestId('settings-modal'), 'requestClose');
  expect(screen.getByLabelText('로그인 정보: member@example.com')).toBeTruthy();
});
it('retries a failed read and returns to settings before exiting the host modal', async () => {
  const a = source(),
    back = jest.fn();
  a.documents!.load = jest
    .fn<NonNullable<SettingsActions['documents']>['load']>()
    .mockRejectedValueOnce(new Error('private detail'))
    .mockResolvedValue(docs);
  await render(<SettingsScreen modal actions={a} onBack={back} />);
  await press('약관 · 개인정보 열기');
  expect(screen.getByText('문서를 불러오지 못했어요.')).toBeTruthy();
  expect(screen.queryByText('private detail')).toBeNull();
  await press('문서 다시 불러오기');
  await press('서비스 이용약관 보기');
  expect(screen.getByText('약관 본문')).toBeTruthy();
  await press('문서 닫기');
  await fireEvent(screen.getByTestId('settings-modal'), 'requestClose');
  expect(back).not.toHaveBeenCalled();
  await fireEvent(screen.getByTestId('settings-modal'), 'requestClose');
  expect(back).toHaveBeenCalledTimes(1);
});
it.each(['success', 'failure'] as const)(
  'cancels an old document read and ignores its late %s on account replacement',
  async (mode) => {
    const a = source(),
      old = deferred<ConsentDocuments>(),
      load = jest.fn<NonNullable<SettingsActions['documents']>['load']>(
        () => old.promise,
      );
    a.documents!.load = load;
    await render(<SettingsScreen modal actions={a} onBack={() => {}} />);
    await press('약관 · 개인정보 열기');
    await screen.rerender(
      <SettingsScreen
        modal
        actions={source('next@example.com')}
        onBack={() => {}}
      />,
    );
    expect(load.mock.calls[0][0].aborted).toBe(true);
    await act(async () =>
      mode === 'success' ? old.resolve(docs) : old.reject(new Error('late')),
    );
    expect(screen.queryByText('member@example.com')).toBeNull();
    expect(screen.getByLabelText('로그인 정보: next@example.com')).toBeTruthy();
    expect(screen.queryByText('약관 본문')).toBeNull();
  },
);
it('aborts when the document list is closed while a request is pending', async () => {
  const a = source(),
    old = deferred<ConsentDocuments>(),
    load = jest.fn<NonNullable<SettingsActions['documents']>['load']>(
      () => old.promise,
    );
  a.documents!.load = load;
  await render(<SettingsScreen modal actions={a} onBack={() => {}} />);
  await press('약관 · 개인정보 열기');
  await fireEvent(screen.getByTestId('settings-modal'), 'requestClose');
  expect(load.mock.calls[0][0].aborted).toBe(true);
  await act(async () => old.resolve(docs));
  expect(
    screen.queryByRole('button', { name: '서비스 이용약관 보기' }),
  ).toBeNull();
});
it.each([
  null,
  { ...docs, documents: docs.documents.slice(1) },
  {
    ...docs,
    documents: [{ ...docs.documents[0], body: '' }, ...docs.documents.slice(1)],
  },
])('treats invalid documents as a retryable failure', async (value) => {
  const a = source();
  a.documents!.load = async () => value as ConsentDocuments;
  await render(<SettingsScreen actions={a} onBack={() => {}} />);
  await press('약관 · 개인정보 열기');
  expect(
    screen.getByRole('button', { name: '문서 다시 불러오기' }),
  ).toBeTruthy();
});
it('shares signup and settings example documents and keeps their returned snapshots independent', async () => {
  jest.useFakeTimers();
  const signup = createMockSignup();
  const settings = createMockSettings();
  const p = signup.loadDocuments(new AbortController().signal),
    q = settings.documents!.load(new AbortController().signal);
  await jest.runAllTimersAsync();
  const first = await p,
    second = await q;
  expect(second).toEqual(first);
  first.documents[0].body = 'changed snapshot';
  expect(second.documents[0].body).toContain('체험판 검토안');
});

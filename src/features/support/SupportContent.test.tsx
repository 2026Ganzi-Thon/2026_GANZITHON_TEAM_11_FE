import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { Support } from '../../api/contracts';
import { SupportContent } from './SupportContent';
const data: Support = {
  message: '잠시 쉬어 가도 괜찮아요.',
  resources: [
    { label: '전화 앱 열기', action: 'call', target: '01000000000' },
    {
      label: '안내 사이트 열기',
      action: 'open_url',
      target: 'https://example.com/help',
    },
  ],
};
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
afterEach(() => {
  jest.restoreAllMocks();
});
it('reports launch failure beside the pressed resource, keeps the draft return and allows explicit retry', async () => {
  const open = jest
    .fn<(resource: Support['resources'][number]) => Promise<void>>()
    .mockRejectedValueOnce(new Error('private detail'))
    .mockResolvedValue(undefined);
  const back = jest.fn();
  await render(
    <SupportContent support={data} onReturn={back} openResource={open} />,
  );
  await press('안내 사이트 열기');
  expect(screen.getByRole('alert')).toHaveTextContent(/앱을 열지 못했어요/);
  expect(screen.queryByText('private detail')).toBeNull();
  await press('안내 사이트 열기');
  expect(screen.queryByRole('alert')).toBeNull();
  expect(open).toHaveBeenCalledTimes(2);
  await press('쓰던 글로 돌아가기');
  expect(back).toHaveBeenCalledTimes(1);
});
it('blocks duplicate launch while keeping return enabled, and isolates late failure after a support source change', async () => {
  let reject!: (error: Error) => void;
  const open = jest.fn<() => Promise<void>>().mockImplementation(
    () =>
      new Promise((_, r) => {
        reject = r;
      }),
  );
  const back = jest.fn();
  const view = await render(
    <SupportContent support={data} onReturn={back} openResource={open} />,
  );
  await press('전화 앱 열기');
  await press('전화 앱 열기');
  await press('안내 사이트 열기');
  expect(open).toHaveBeenCalledTimes(1);
  expect(
    screen.getByRole('button', { name: '쓰던 글로 돌아가기' }),
  ).toBeEnabled();
  await press('쓰던 글로 돌아가기');
  expect(back).toHaveBeenCalledTimes(1);
  await view.rerender(
    <SupportContent
      support={{ ...data, message: '새 안내' }}
      onReturn={back}
      openResource={open}
    />,
  );
  await act(async () => reject(new Error('late')));
  expect(screen.getByText('새 안내')).toBeTruthy();
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByRole('button', { name: '전화 앱 열기' })).toBeEnabled();
});
it('does not report an accepted app launch as successful counseling or clear the draft', async () => {
  const open = jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    back = jest.fn();
  await render(
    <SupportContent support={data} onReturn={back} openResource={open} />,
  );
  await press('전화 앱 열기');
  expect(back).not.toHaveBeenCalled();
  expect(screen.getByText('잠시 쉬어 가도 괜찮아요.')).toBeTruthy();
  expect(screen.queryByText(/상담을 완료/)).toBeNull();
});
it('shows recoverable missing data and disables an invalid target instead of executing it', async () => {
  const open = jest.fn<() => Promise<void>>();
  const view = await render(
    <SupportContent
      support={undefined}
      onReturn={() => {}}
      openResource={open}
    />,
  );
  expect(screen.getByRole('alert')).toHaveTextContent(
    /도움 안내를 불러오지 못했어요/,
  );
  expect(
    screen.getByRole('button', { name: '쓰던 글로 돌아가기' }),
  ).toBeEnabled();
  await view.rerender(
    <SupportContent
      support={{
        ...data,
        resources: [
          {
            label: '잘못된 링크',
            action: 'open_url',
            target: 'intent://anything',
          },
        ],
      }}
      onReturn={() => {}}
      openResource={open}
    />,
  );
  expect(screen.getByRole('button', { name: '잘못된 링크' })).toBeDisabled();
  await press('잘못된 링크');
  expect(open).not.toHaveBeenCalled();
});
it('ignores a delayed native failure when new support arrives before the old request ends', async () => {
  let reject!: (error: Error) => void;
  const open = jest.fn<() => Promise<void>>().mockImplementation(
    () =>
      new Promise((_, r) => {
        reject = r;
      }),
  );
  const view = await render(
    <SupportContent support={data} onReturn={() => {}} openResource={open} />,
  );
  await press('전화 앱 열기');
  await view.rerender(
    <SupportContent
      support={{
        message: '새 소스의 도움 안내',
        resources: [data.resources[1]],
      }}
      onReturn={() => {}}
      openResource={open}
    />,
  );
  await act(async () => reject(new Error('stale')));
  expect(screen.getByText('새 소스의 도움 안내')).toBeTruthy();
  expect(screen.queryByRole('alert')).toBeNull();
  expect(
    screen.getByRole('button', { name: '안내 사이트 열기' }),
  ).toBeEnabled();
});
it('keeps a late launch failure hidden after returning even before the parent unmounts', async () => {
  let reject!: (error: Error) => void;
  const open = jest.fn<() => Promise<void>>().mockImplementation(
    () =>
      new Promise((_, r) => {
        reject = r;
      }),
  );
  const back = jest.fn();
  await render(
    <SupportContent support={data} onReturn={back} openResource={open} />,
  );
  await press('전화 앱 열기');
  await press('쓰던 글로 돌아가기');
  await act(async () => reject(new Error('late')));
  expect(back).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('alert')).toBeNull();
});

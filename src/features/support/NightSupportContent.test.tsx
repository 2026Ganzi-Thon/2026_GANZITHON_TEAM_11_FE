import { afterEach, expect, it, jest } from '@jest/globals';
import { Platform } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { Support } from '../../api/contracts';
import { SupportContent } from './SupportContent';
const data: Support = {
  message: '도움 안내 예시',
  resources: [
    { label: '연락처 앱 열기', action: 'open_contacts', target: null },
  ],
};
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
afterEach(() => {
  jest.restoreAllMocks();
});
it('keeps night resource actions usable after continue fails, and blocks duplicate actions only while waiting', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const next = jest.fn(),
    reload = jest.fn(),
    open = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const props = {
    support: data,
    context: 'night' as const,
    onContinue: next,
    onReload: reload,
    pending: null,
    error: null,
    openResource: open,
  };
  const view = await render(<SupportContent {...props} />);
  expect(
    screen.queryByRole('button', { name: '쓰던 글로 돌아가기' }),
  ).toBeNull();
  await press('계속하기');
  expect(next).toHaveBeenCalledTimes(1);
  await view.rerender(
    <SupportContent {...props} pending={'continue' as const} />,
  );
  expect(screen.getByRole('button', { name: '계속하는 중' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '연락처 앱 열기' })).toBeDisabled();
  await view.rerender(
    <SupportContent
      {...props}
      error="계속하기 응답을 확인하지 못했어요. 다시 시도해 주세요."
    />,
  );
  expect(screen.getByRole('alert')).toHaveTextContent(
    /계속하기 응답을 확인하지 못했어요/,
  );
  await press('연락처 앱 열기');
  expect(open).toHaveBeenCalledTimes(1);
  await press('계속하기');
  expect(next).toHaveBeenCalledTimes(2);
});
it('does not continue without support and exposes an explicit reload instead of sending the user through', async () => {
  const next = jest.fn(),
    reload = jest.fn();
  const props = {
    context: 'night' as const,
    onContinue: next,
    onReload: reload,
    pending: null,
    error: null,
  };
  const view = await render(<SupportContent {...props} support={null} />);
  expect(screen.getByRole('alert')).toHaveTextContent(
    /도움 안내를 불러오지 못했어요/,
  );
  expect(screen.getByRole('button', { name: '계속하기' })).toBeDisabled();
  await press('계속하기');
  expect(next).not.toHaveBeenCalled();
  await press('도움 안내 다시 불러오기');
  expect(reload).toHaveBeenCalledTimes(1);
  await view.rerender(
    <SupportContent {...props} support={null} pending={'reload' as const} />,
  );
  expect(screen.getByRole('button', { name: '안내 확인 중' })).toBeDisabled();
  await view.rerender(<SupportContent {...props} support={data} />);
  expect(screen.getByText('도움 안내 예시')).toBeTruthy();
  expect(
    screen.queryByRole('button', { name: '도움 안내 다시 불러오기' }),
  ).toBeNull();
  expect(screen.getByRole('button', { name: '계속하기' })).toBeEnabled();
});
it('forwards the matching phone and web resources in night rows without treating either as continue', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const next = jest.fn(),
    open = jest
      .fn<(resource: Support['resources'][number]) => Promise<void>>()
      .mockResolvedValue(undefined);
  const resources: Support['resources'] = [
    { label: '전화 앱 열기', action: 'call', target: '01000000000' },
    ...data.resources,
    {
      label: '웹 안내 열기',
      action: 'open_url',
      target: 'https://example.com/help',
    },
  ];
  await render(
    <SupportContent
      context="night"
      support={{ ...data, resources }}
      pending={null}
      error={null}
      onContinue={next}
      onReload={() => {}}
      openResource={open}
    />,
  );
  await press('전화 앱 열기');
  expect(open).toHaveBeenLastCalledWith(resources[0]);
  await press('웹 안내 열기');
  expect(open).toHaveBeenLastCalledWith(resources[2]);
  expect(next).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: '계속하기' })).toBeEnabled();
});

import { expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import SupportPreview from '../../app/dev/card-support';
jest.mock('expo-router', () => ({
  Redirect: () => null,
  router: { canGoBack: () => false, replace: jest.fn() },
}));
it('starts a fresh writing session for each preview and keeps help data errors returnable', async () => {
  jest.useFakeTimers();
  try {
    await render(<SupportPreview />);
    await fireEvent.press(
      screen.getByRole('button', { name: '글 작성 → 도움 안내' }),
    );
    expect(
      screen.getByDisplayValue('내 속도로 쉬어 가도 괜찮아요.'),
    ).toBeTruthy();
    await fireEvent.press(
      screen.getByRole('button', { name: '검수 요청하기' }),
    );
    await act(async () => {
      await jest.advanceTimersByTimeAsync(450);
    });
    expect(screen.getByText('도움받을 곳')).toBeTruthy();
    await fireEvent.press(
      screen.getByRole('button', { name: '쓰던 글로 돌아가기' }),
    );
    await fireEvent.press(screen.getByRole('button', { name: '이전' }));
    await fireEvent.press(screen.getByRole('button', { name: '이전' }));
    await fireEvent.press(
      screen.getByRole('button', { name: '안내 데이터 누락' }),
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/불러오지 못했어요/);
    await fireEvent.press(
      screen.getByRole('button', { name: '쓰던 글로 돌아가기' }),
    );
    expect(
      screen.getByRole('button', { name: '글 작성 → 도움 안내' }),
    ).toBeTruthy();
  } finally {
    jest.useRealTimers();
  }
});

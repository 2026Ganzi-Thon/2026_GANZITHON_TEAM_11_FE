import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { MorningScreen } from '../morning/MorningScreen';
import { createSettingsMorning } from '../../mocks/settingsMorning';
import { createMockBirthDate } from '../../mocks/birthDate';
const tick = () =>
  act(async () => {
    await jest.runAllTimersAsync();
  });
const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
async function open(source = createSettingsMorning()) {
  jest.useFakeTimers();
  await render(
    <MorningScreen
      actions={source}
      loadDetail={source.loadSheep}
      onExit={() => {}}
    />,
  );
  await tick();
  await press('설정 열기');
  await tick();
  return source;
}
async function choose() {
  await press('생년월일 열기');
  await tick();
  await fireEvent(
    screen.getByRole('adjustable', { name: '출생 월' }),
    'accessibilityAction',
    { nativeEvent: { actionName: 'increment' } },
  );
  await press('한 번만 바꿀 수 있어요!');
}
afterEach(() => {
  jest.useRealTimers();
});
it('shares a saved birth date with settings and the next fortune, retaining it on same-source reentry', async () => {
  const source = await open();
  expect(screen.getByText('2004.05.14 · 수정 1회')).toBeTruthy();
  await choose();
  await press('이 생일로 변경하기');
  await tick();
  expect(screen.getByText('생년월일을 변경했어요.')).toBeTruthy();
  await press('돌아가기');
  await tick();
  expect(screen.getByText('2004.06.14 · 수정 0회')).toBeTruthy();
  await press('생년월일 열기');
  await tick();
  expect(screen.getByText('등록된 생일이에요')).toBeTruthy();
  expect(
    screen.getByRole('button', { name: '변경할 수 없어요' }),
  ).toBeDisabled();
  await press('생년월일 변경 닫기');
  await tick();
  await press('아침 홈으로 돌아가기');
  await tick();
  await press('오늘의 운세 보기');
  expect(screen.getByText('쌍둥이자리')).toBeTruthy();
  expect(screen.getByText('느긋한 양')).toBeTruthy();
  expect(screen.queryByText(/황소자리/)).toBeNull();
  await press('오늘의 운세 닫기');
  await screen.unmount();
  await render(<MorningScreen actions={source} onExit={() => {}} />);
  await tick();
  await press('설정 열기');
  await tick();
  expect(screen.getByText('2004.06.14 · 수정 0회')).toBeTruthy();
});
it('keeps the birthday modal open for Android back while saving, then refreshes the settings profile', async () => {
  const source = createSettingsMorning('success', {
    birthDate: createMockBirthDate('slow'),
  });
  await open(source);
  await choose();
  await press('이 생일로 변경하기');
  await fireEvent(screen.getByTestId('birth-date-modal'), 'requestClose');
  expect(screen.getByRole('button', { name: '변경 확인 중' })).toBeDisabled();
  await tick();
  await press('돌아가기');
  await tick();
  expect(screen.getByText('2004.06.14 · 수정 0회')).toBeTruthy();
});

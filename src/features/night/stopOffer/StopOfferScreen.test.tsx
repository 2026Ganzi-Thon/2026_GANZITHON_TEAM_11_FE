import { afterEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import { stopOfferPosition } from './model';
import { StopOfferScreen } from './StopOfferScreen';
afterEach(() => {
  jest.restoreAllMocks();
});
it.each([
  [3, null],
  [15, null],
  [16, 14],
  [20, 14],
  [30, 14],
  [31, null],
  [16.5, null],
  [NaN, null],
] as const)(
  'only offers a stop at the eligible position for %s sheep',
  (count, want) => {
    expect(stopOfferPosition(count)).toBe(want);
  },
);
it.each([16, 30])(
  'continues %s sheep without finishing the night',
  async (sheepCount) => {
    const onStop = jest.fn(),
      onContinue = jest.fn();
    await render(
      <StopOfferScreen
        sheepCount={sheepCount}
        onStop={onStop}
        onContinue={onContinue}
        onBack={() => {}}
      />,
    );
    expect(screen.getByText(`14 / ${sheepCount}`)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '계속 셀래요' }));
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onStop).not.toHaveBeenCalled();
  },
);
it.each(['그만 셀래요', '그만 세고 싶어요'])(
  'starts early closing only for %s',
  async (label) => {
    const onStop = jest.fn(),
      onContinue = jest.fn();
    await render(
      <StopOfferScreen
        sheepCount={20}
        onStop={onStop}
        onContinue={onContinue}
        onBack={() => {}}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: label }));
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(onContinue).not.toHaveBeenCalled();
  },
);
it('does not offer stop or continue controls below sixteen sheep', async () => {
  await render(
    <StopOfferScreen
      sheepCount={15}
      onStop={() => {}}
      onContinue={() => {}}
      onBack={() => {}}
    />,
  );
  expect(screen.queryByRole('button', { name: '그만 셀래요' })).toBeNull();
  expect(screen.queryByRole('button', { name: '계속 셀래요' })).toBeNull();
});
it('goes back without choosing to finish and releases its Android back listener', async () => {
  let back: (() => boolean | null | undefined) | undefined;
  const remove = jest.fn();
  jest
    .spyOn(BackHandler, 'addEventListener')
    .mockImplementation((_event, fn) => {
      back = () => fn({} as Parameters<typeof fn>[0]);
      return { remove };
    });
  const onBack = jest.fn(),
    onStop = jest.fn();
  await render(
    <StopOfferScreen
      sheepCount={20}
      onStop={onStop}
      onContinue={() => {}}
      onBack={onBack}
    />,
  );
  expect(back?.()).toBe(true);
  expect(onBack).toHaveBeenCalledTimes(1);
  expect(onStop).not.toHaveBeenCalled();
  await screen.unmount();
  expect(remove).toHaveBeenCalledTimes(1);
});

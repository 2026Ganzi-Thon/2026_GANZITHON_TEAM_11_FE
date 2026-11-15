import { afterEach, expect, it, jest } from '@jest/globals';
import { Linking } from 'react-native';
import { openSupportResource } from './device';
afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});
it('opens the dialer through VIEW linking without placing a call', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  await openSupportResource({
    label: '전화 앱',
    action: 'call',
    target: '01000000000',
  });
  expect(open).toHaveBeenCalledWith('tel:01000000000');
});
it('handles native launch rejection and never forwards invalid targets', async () => {
  const open = jest
    .spyOn(Linking, 'openURL')
    .mockRejectedValue(new Error('private native detail'));
  await expect(
    openSupportResource({
      label: '웹',
      action: 'open_url',
      target: 'https://example.com',
    }),
  ).rejects.toThrow('open-failed');
  await expect(
    openSupportResource({
      label: '웹',
      action: 'open_url',
      target: 'intent://anything',
    }),
  ).rejects.toThrow('unavailable');
  expect(open).toHaveBeenCalledTimes(1);
});

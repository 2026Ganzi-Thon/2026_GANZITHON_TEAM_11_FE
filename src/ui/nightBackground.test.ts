import { expect, it, jest } from '@jest/globals';
import { Image, type ImageRef } from 'expo-image';
import {
  nightBackgroundSource,
  prepareNightBackground,
} from './nightBackground';

it('reuses one decoded sky across screen exports without replacing custom imagery', async () => {
  const decoded = { width: 1080, height: 2340 } as ImageRef;
  const load = jest.spyOn(Image, 'loadAsync').mockResolvedValue(decoded);
  try {
    await Promise.all([prepareNightBackground(), prepareNightBackground()]);
    expect(
      nightBackgroundSource(require('../../assets/images/night-sky.svg')),
    ).toBe(decoded);
    expect(
      nightBackgroundSource(
        require('../../assets/images/signup/birth-background.svg'),
      ),
    ).toBe(decoded);
    expect(
      nightBackgroundSource(
        require('../../assets/images/settings/background.svg'),
      ),
    ).toBe(decoded);
    await prepareNightBackground();
    expect(load).toHaveBeenCalledTimes(1);
    const custom = { uri: 'https://example.com/different-background.png' };
    expect(nightBackgroundSource(custom)).toBe(custom);
  } finally {
    load.mockRestore();
  }
});

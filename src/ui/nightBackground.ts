import { Image, type ImageRef, type ImageSource } from 'expo-image';
import { Dimensions, PixelRatio } from 'react-native';

// These Figma exports contain identical paths/colors; SVG IDs are their only difference.
const skies = new Set<number>([
  require('../../assets/images/night-sky.svg'),
  require('../../assets/images/birth-date/background.svg'),
  require('../../assets/images/closing/offer-sky.svg'),
  require('../../assets/images/closing/summary-sky.svg'),
  require('../../assets/images/entrust/background.svg'),
  require('../../assets/images/my-cards/background.svg'),
  require('../../assets/images/night-return/background.svg'),
  require('../../assets/images/night-support/background.svg'),
  require('../../assets/images/password-reset/sent-background.svg'),
  require('../../assets/images/reminder/background.svg'),
  require('../../assets/images/settings/background.svg'),
  require('../../assets/images/settings/worry-background.svg'),
  require('../../assets/images/signup-reminder/background.svg'),
  require('../../assets/images/signup/birth-background.svg'),
  require('../../assets/images/signup/consent-background.svg'),
  require('../../assets/images/signup/welcome-background.svg'),
  require('../../assets/images/stop-offer/background.svg'),
  require('../../assets/images/text-card/night.svg'),
]);
let prepared: ImageRef | undefined;
let pending: Promise<void> | undefined;

/** Keep one decoded native image for the app lifetime, including opaque modal windows. */
export function prepareNightBackground(): Promise<void> {
  if (prepared) return Promise.resolve();
  if (!pending) {
    const { width, height } = Dimensions.get('window');
    pending = Image.loadAsync(require('../../assets/images/night-sky.svg'), {
      maxWidth: Math.min(1440, PixelRatio.getPixelSizeForLayoutSize(width)),
      maxHeight: Math.min(3200, PixelRatio.getPixelSizeForLayoutSize(height)),
    })
      .then((image) => {
        prepared = image;
      })
      .catch((error: unknown) => {
        pending = undefined;
        throw error;
      });
  }
  return pending;
}
export function nightBackgroundSource(source: ImageSource | number) {
  return prepared && skies.has(source as number) ? prepared : source;
}

import { expect, it } from '@jest/globals';
import { SheepArt } from './SheepArt';

it('uses the neutral asset for unknown response keys, including object property names', () => {
  for (const colorKey of [null, 'unknown', 'constructor', '__proto__']) {
    expect(SheepArt({ colorKey }).props.source).toEqual(
      require('../../../assets/images/morning/sheep-neutral.svg'),
    );
  }
});
